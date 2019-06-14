/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

import { promises as fs, constants } from 'fs';
import { isAbsolute, join, relative, sep } from 'path';
import { wrapP } from './wrapP';
import {
    Theme,
    ModuleConfig,
    ThemeAsset,
    ModuleAsset,
    StaticAsset,
    Module,
} from './types';
import { flatten } from './flatten';
import { parse } from 'fast-xml-parser';

// Fix this, because themes can be in vendor
const THEME_ROOT = 'app/design';
const CODE_ROOT = 'app/code';
// TODO: Fix this, because it's very wrong
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
 * of whether or not they are enabled, and returns config info
 */
export async function getModulesOnDisk(root: string): Promise<ModuleConfig[]> {
    assertAbsolute(root);
    const [firstPartyVendors, thirdPartyVendors] = await Promise.all([
        safeDirRead(join(root, CODE_ROOT)),
        safeDirRead(join(root, VENDOR_ROOT)),
    ]);

    const modulesForVendors = (vendors: string[], dir: string) =>
        Promise.all(
            vendors.map(async vendor => {
                const vendorPath = join(root, dir, vendor);
                const modules = await safeDirRead(vendorPath);
                // TODO: Move module.xml parsing out of `getModulesOnDisk`, because
                // we waste using the full XML parser for modules we won't use
                return Promise.all(
                    modules.map(async mod => {
                        const sequence = await getModuleSequence(
                            vendorPath,
                            mod,
                        );
                        return {
                            name: `${vendor}_${mod}`,
                            sequence,
                        };
                    }),
                );
            }),
        );

    const [firstPartyModules, thirdPartyModules] = await Promise.all([
        modulesForVendors(firstPartyVendors, CODE_ROOT),
        modulesForVendors(thirdPartyVendors, VENDOR_ROOT),
    ]);

    return flatten([...firstPartyModules, ...thirdPartyModules]);
}

export async function getModuleSequence(
    vendorPath: string,
    moduleName: string,
) {
    assertAbsolute(vendorPath);
    const configPath = join(vendorPath, moduleName, 'etc/module.xml');
    const rawConfig = await fs.readFile(configPath, 'utf8');
    const config = parse(rawConfig, {
        ignoreAttributes: false,
        attributeNamePrefix: '',
        ignoreNameSpace: true,
    });

    const { sequence } = config.config.module;
    // no dependencies
    if (!sequence) return [] as string[];

    // multiple dependencies
    if (Array.isArray(sequence.module)) {
        return sequence.module.map((m: any) => m.name) as string[];
    }

    // single dependency
    return [sequence.module.name] as string[];
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
    // Note: Skipping a full blown XML parser (for now) to maintain speed.
    // Sander will hate me :D
    const [, parent = ''] = source!.match(/<parent>(.+)<\/parent>/) || [];

    if (parent) {
        const [vendor, name] = parent.split(sep);
        return { name, vendor, area: theme.area };
    }
}

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

    const isModuleContext = /[a-z0-9]+_[a-z0-9]+/i.test(pieces[0]);
    if (isModuleContext) {
        const [vendor, name] = pieces[0].split('_');
        return {
            type: 'ThemeAsset',
            theme,
            module: { vendor, name },
            pathFromStoreRoot: path,
        };
    }

    return { type: 'ThemeAsset', theme, pathFromStoreRoot: path };
}

export function parseModulePath(
    path: string,
    moduleContext: string,
): ModuleAsset {
    const [vendor, name] = moduleContext.split('_');

    return {
        type: 'ModuleAsset',
        module: { name, vendor },
        pathFromStoreRoot: path,
    };
}

export function finalPathFromStaticAsset(asset: StaticAsset) {
    switch (asset.type) {
        case 'RootAsset':
            return relative(
                join(sep, 'web'),
                join(sep, asset.pathFromStoreRoot),
            );
        case 'ThemeAsset': {
            if (asset.module) {
                // ex: Magento_Foobar
                const namespace = moduleToModuleNamespace(asset.module);
                // ex: /web/css/source/module/checkout/_checkout-agreements.less
                const afterModule = asset.pathFromStoreRoot.split(namespace)[1];
                // ex: css/source/module/checkout/_checkout-agreements.less
                const afterWebDir = relative(join(sep, 'web'), afterModule);
                return join(namespace, afterWebDir);
            }

            const pathChunks = asset.pathFromStoreRoot.split(sep);
            const firstWebDirIdx = pathChunks.findIndex(p => p === 'web');
            const afterWebDir = pathChunks.slice(firstWebDirIdx + 1).join(sep);
            return afterWebDir;
        }
        case 'ModuleAsset': {
            // ex: Magento/Foobar
            const modulePathPiece = join(
                asset.module.vendor,
                asset.module.name,
            );
            // ex: /view/frontend/web/template/summary/grand-total.html
            const afterModule = asset.pathFromStoreRoot.split(
                modulePathPiece,
            )[1];
            const pathChunks = afterModule.split(sep);
            const firstWebDirIdx = pathChunks.findIndex(p => p === 'web');
            // ex: template/summary/grand-total.html
            const afterWebDir = pathChunks.slice(firstWebDirIdx + 1).join(sep);
            // ex: Magento_Foobar
            const namespace = moduleToModuleNamespace(asset.module);
            return join(namespace, afterWebDir);
        }
    }
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

export async function getModuleViewDir(
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

function moduleToModuleNamespace(mod: Module) {
    return `${mod.vendor}_${mod.name}`;
}

/**
 * @summary Wrapper around fs.readdir that _always_ returns an array
 */
async function safeDirRead(path: string) {
    return fs.readdir(path).catch(() => [] as string[]);
}
