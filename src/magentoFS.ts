/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

import { promises as fs, constants } from 'fs';
import { isAbsolute, join, relative, sep } from 'path';
import { wrapP } from './wrapP';
import { Theme } from './types';
import { flatten } from './flatten';

const THEME_ROOT = 'app/design';
const CODE_ROOT = 'app/code';
const VENDOR_ROOT = 'app/vendor';

/**
 * @summary Parses config.php to find a list of enabled modules
 * @see https://devdocs.magento.com/guides/v2.3/config-guide/config/config-php.html
 */
const CONFIG_PATH = 'app/etc/config.php';
export async function getEnabledModules(root: string) {
    assertAbsolute(root);
    const path = join(root, CONFIG_PATH);
    const [err, raw] = await wrapP(fs.readFile(path, 'utf8'));
    if (err) {
        throw new Error(`Failed reading Magento config.php at ${path}`);
    }

    const enabledModules: string[] = [];
    for (const line of raw!.split('\n')) {
        // Note: Attempting to get away with a RegExp here instead
        // of a full-blown parser. config.php is code-gen'd, so
        // the format _should_ be consistent
        const matches = line.match(/^\s*'(\w+)'\s*=>\s*(\d)/);
        if (!matches) continue;

        const [, moduleName, enabled] = matches;
        if (Number(enabled)) enabledModules.push(moduleName);
    }

    return enabledModules;
}

/**
 * @summary Finds all modules in app/code and app/vendor, regardless
 * of whether or not they are enabled
 */
export async function getModulesOnDisk(root: string) {
    assertAbsolute(root);
    const [firstPartyVendors, thirdPartyVendors] = await Promise.all([
        safeDirRead(join(root, CODE_ROOT)),
        safeDirRead(join(root, VENDOR_ROOT)),
    ]);

    const modulesForVendors = (vendors: string[], dir: string) =>
        Promise.all(
            vendors.map(async vendor => {
                const modules = await safeDirRead(join(root, dir, vendor));
                return modules.map(mod => `${vendor}_${mod}`);
            }),
        );

    const [firstPartyModules, thirdPartyModules] = await Promise.all([
        modulesForVendors(firstPartyVendors, CODE_ROOT),
        modulesForVendors(thirdPartyVendors, VENDOR_ROOT),
    ]);

    return flatten([...firstPartyModules, ...thirdPartyModules]);
}

/**
 * @summary Finds all themes for both front-end and back-end.
 * Themes are included regardless of whether or not they're used
 */
export async function getThemes(root: string): Promise<Theme[]> {
    assertAbsolute(root);
    const areas = {
        frontend: join(root, THEME_ROOT, 'frontend'),
        adminhtml: join(root, THEME_ROOT, 'adminhtml'),
    };

    const [frontendVendors, adminVendors] = await Promise.all([
        fs.readdir(areas.frontend),
        fs.readdir(areas.adminhtml),
    ]);

    const themesForVendors = (vendors: string[], area: keyof typeof areas) =>
        Promise.all(
            vendors.map(async vendor => {
                const themes = await fs.readdir(join(areas[area], vendor));
                return themes.map(name => ({ name, vendor, area }));
            }),
        );

    const [frontendThemes, adminThemes] = await Promise.all([
        themesForVendors(frontendVendors, 'frontend'),
        themesForVendors(adminVendors, 'adminhtml'),
    ]);

    return flatten([...frontendThemes, ...adminThemes]);
}

export function themeToPath(root: string, theme: Theme) {
    return join(root, THEME_ROOT, theme.area, theme.vendor, theme.name);
}

/**
 * @summary Recursively resolve the inheritance hierarchy for a theme
 */
export async function getThemeHierarchy(
    root: string,
    theme: Theme,
    deps?: Theme[],
): Promise<Theme[]> {
    const dependencies = deps || [theme];
    const parent = await getThemeParent(root, theme);
    if (!parent) {
        return dependencies;
    }

    dependencies.unshift(parent);
    return getThemeHierarchy(root, parent, dependencies);
}

function assertAbsolute(path: string) {
    if (isAbsolute(path)) return;
    throw new Error(
        `Expected an absolute path for the store root, but instead saw: "${path}"`,
    );
}

/**
 * @summary Determine which (if any) theme a given theme inherits from
 */
async function getThemeParent(root: string, theme: Theme) {
    assertAbsolute(root);
    const themeXMLPath = join(themeToPath(root, theme), 'theme.xml');
    const [err, source] = await wrapP(fs.readFile(themeXMLPath, 'utf8'));
    if (err) {
        throw new Error(
            'Could not find "theme.xml" for ' +
                `"${theme.vendor}/${theme.name}" in "${themeXMLPath}"`,
        );
    }
    // Note: Skipping a full blown XML parser (for now) to maintain
    // speed and not take on an extra dep
    const [, parent = ''] = source!.match(/<parent>(.+)<\/parent>/) || [];

    if (parent) {
        const [vendor, name] = parent.split('/');
        return { name, vendor, area: theme.area };
    }
}

export type ThemeAsset = {
    type: 'ThemeAsset';
    theme: Theme;
    moduleContext?: string;
    path: string;
};
export type ModuleAsset = {
    type: 'ModuleAsset';
    moduleContext: string;
    path: string;
};

export type StaticAsset = ThemeAsset | ModuleAsset;

/**
 * @summary Provide contextful information about a file path within a theme
 */
export function parseThemePath(path: string): ThemeAsset {
    const [, relPath] = path.split(THEME_ROOT);
    const [, ...pieces] = relPath.split(sep);

    const theme = {
        area: pieces.shift() as 'frontend' | 'adminhtml',
        vendor: pieces.shift() as string,
        name: pieces.shift() as string,
    };

    const isModuleContext = /[a-z]+_[a-z]+/i.test(pieces[0]);
    if (isModuleContext) {
        return {
            type: 'ThemeAsset',
            theme,
            moduleContext: pieces[0],
            path: pieces.slice(1).join(sep),
        };
    }

    return { type: 'ThemeAsset', theme, path: pieces.join(sep) };
}

export function parseModulePath(
    path: string,
    moduleContext: string,
): ModuleAsset {
    const [vendor, name] = moduleContext.split('_');
    const [, relPath] = path.split(`${vendor}${sep}${name}`);

    return {
        type: 'ModuleAsset',
        moduleContext,
        path: relPath,
    };
}

export function moduleAssetToThemePath(moduleAsset: ModuleAsset) {
    const hacky = moduleAsset.path.replace('/view/frontend/web/', '');
    return join(moduleAsset.moduleContext, hacky);
}

/**
 * @summary Given a ThemeFile, will return the path
 * (including module context, when applicable) excluding
 * any theme info from the path
 */
export function themeFileToThemeless(themeFile: ThemeAsset) {
    return typeof themeFile.moduleContext === 'string'
        ? join(themeFile.moduleContext, themeFile.path)
        : themeFile.path;
}

async function getPathForModule(root: string, name: string) {
    const [vendor, mod] = name.split('_');
    const vendorDirPath = join(root, VENDOR_ROOT, vendor, mod);
    const codeDirPath = join(root, CODE_ROOT, vendor, mod);

    const [err] = await wrapP(fs.access(vendorDirPath));
    // Warning: We're assuming that, if the module does not
    // exist in one location, it has to exist in the other.
    // Might end up being a bug farm
    const absPath = err ? codeDirPath : vendorDirPath;
    return relative(root, absPath);
}

async function getModuleViewDir(
    root: string,
    name: string,
    area: 'frontend' | 'adminhtml',
) {
    assertAbsolute(root);
    const modulePath = await getPathForModule(root, name);
    return join(modulePath, 'view', area);
}

export async function getModuleWebDir(
    root: string,
    name: string,
    area: 'frontend' | 'adminhtml',
) {
    return join(await getModuleViewDir(root, name, area), 'web');
}

/**
 * @summary Wrapper around fs.readdir that _always_ returns an array
 */
async function safeDirRead(path: string) {
    return fs.readdir(path).catch(() => [] as string[]);
}
