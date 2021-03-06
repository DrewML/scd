/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

import { promises as fs } from 'fs';
import { isAbsolute, join, relative, sep } from 'path';
import { wrapP } from './wrapP';
import { ThemeAsset, ModuleAsset, Module, Theme, Components } from './types';
import { flatten } from './flatten';
import { parse } from 'fast-xml-parser';
import fromEntries from 'fromentries';

/**
 * @summary Parses config.php to find a list of enabled modules
 * @see https://devdocs.magento.com/guides/v2.3/config-guide/config/config-php.html
 * @todo This will break if app:config:dump has been run, Fix it
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
        // of a full-blown PHP parser. config.php is code-gen'd, so
        // the format _should_ be consistent
        const matches = line.match(/^\s*'(\w+)'\s*=>\s*(\d)/);
        if (!matches) continue;

        const [, moduleName, enabled] = matches;
        if (Number(enabled)) enabledModules.push(moduleName);
    }

    return enabledModules;
}

/**
 * @summary Takes a guess at whether or not a dir is a
 *          Magento store root
 */
export async function isMagentoRoot(root: string) {
    assertAbsolute(root);
    const files = await fs.readdir(root);
    return (
        files.includes('index.php') &&
        files.includes('app') &&
        files.includes('vendor')
    );
}

/**
 * @summary Finds all Magento components (modules/themes) in
 * both app/code and vendor
 */
export async function getComponents(root: string): Promise<Components> {
    assertAbsolute(root);
    const [composer, nonComposer] = await Promise.all([
        getComposerComponents(root),
        getNonComposerComponents(root),
    ]);

    const allModules = [...composer.modules, ...nonComposer.modules];
    const allThemes = [...composer.themes, ...nonComposer.themes];

    const modulesByName = fromEntries(allModules.map(m => [m.moduleID, m]));
    const themesByID = fromEntries(
        allThemes.map(theme => {
            return [theme.themeID, theme];
        }),
    );

    return {
        modules: modulesByName,
        themes: themesByID,
    };
}

type ComposerLock = {
    packages: {
        name: string;
        type:
            | 'magento2-module'
            | 'magento2-theme'
            | 'metapackage'
            | 'magento2-language';
    }[];
};

async function getComposerComponents(root: string) {
    const [, lockfile] = await wrapP(
        fs.readFile(join(root, 'composer.lock'), 'utf8'),
    );
    // Composer lock file isn't a requirement if you're
    // not using composer
    if (!lockfile) {
        return { modules: [], themes: [] };
    }

    // We're relying on the composer lock file because it's
    // significantly faster than crawling each dependency dir
    const composerLock = JSON.parse(lockfile) as ComposerLock;
    const pendingModules: Promise<Module>[] = [];
    const pendingThemes: Promise<Theme>[] = [];

    for (const { name, type } of composerLock.packages) {
        if (type === 'magento2-module') {
            const modulePath = join('vendor', name);
            pendingModules.push(getModuleConfig(root, modulePath));
        }

        if (type === 'magento2-theme') {
            pendingThemes.push(getThemeFromComposerName(root, name));
        }
    }

    return {
        modules: await Promise.all(pendingModules),
        themes: await Promise.all(pendingThemes),
    };
}

async function getNonComposerComponents(root: string) {
    const [modules, themes] = await Promise.all([
        getNonComposerModules(root),
        getNonComposerThemes(root),
    ]);
    return { modules, themes };
}

async function getNonComposerThemes(root: string) {
    const [frontendVendors, adminVendors] = await Promise.all([
        safeDirRead(join(root, 'app', 'design', 'frontend')),
        safeDirRead(join(root, 'app', 'design', 'adminhtml')),
    ]);

    const pendingFrontend = frontendVendors.map(vendor =>
        getNonComposerThemesFromVendorInArea(root, vendor, 'frontend'),
    );
    const pendingAdmin = adminVendors.map(vendor =>
        getNonComposerThemesFromVendorInArea(root, vendor, 'adminhtml'),
    );

    const frontendThemes = flatten(await Promise.all(pendingFrontend));
    const adminThemes = flatten(await Promise.all(pendingAdmin));

    return [...frontendThemes, ...adminThemes];
}

async function getNonComposerThemesFromVendorInArea(
    root: string,
    vendor: string,
    area: Theme['area'],
): Promise<Theme[]> {
    const vendorPath = join('app', 'design', area, vendor);
    const themes = await fs.readdir(join(root, vendorPath), 'utf8');
    return Promise.all(
        themes.map(async name => ({
            name,
            vendor,
            themeID: `${vendor}/${name}`,
            area,
            parentID: await getThemeParentName(join(root, vendorPath, name)),
            pathFromStoreRoot: join(sep, 'app', 'design', area, vendor, name),
        })),
    );
}

async function getThemeParentName(themePath: string) {
    const themeXMLPath = join(themePath, 'theme.xml');
    const [err, source] = await wrapP(fs.readFile(themeXMLPath, 'utf8'));
    if (err) {
        throw new Error(
            `Could not find theme configuration (theme.xml) for theme at "${themeXMLPath}"`,
        );
    }
    // Note: Skipping a full blown XML parser (for now) to maintain speed.
    // Sander will hate me :D
    const [, parent = ''] = source!.match(/<parent>(.+)<\/parent>/) || [];
    return parent;
}

async function getNonComposerModules(root: string) {
    const codeVendorsDir = join(root, 'app', 'code');
    const vendors = await safeDirRead(codeVendorsDir);
    if (!vendors.length) return [];

    const modules = await Promise.all(
        vendors.map(async vendor => {
            const moduleNames = await fs.readdir(
                join(codeVendorsDir, vendor),
                'utf8',
            );
            return Promise.all(
                moduleNames.map(mod =>
                    getModuleConfig(root, join('app', 'code', vendor, mod)),
                ),
            );
        }),
    );

    return flatten(modules);
}

async function getThemeFromComposerName(
    root: string,
    pkgName: string,
): Promise<Theme> {
    const [vendor, pieces] = pkgName.split('/');
    const [firstPart, area, themeName] = pieces.split('-');
    if (
        firstPart !== 'theme' ||
        (area !== 'frontend' && area !== 'adminhtml')
    ) {
        throw new Error(
            `Unrecognized theme package name: ${pkgName}. ` +
                'The format "<vendor>/theme-<area>-<name>" must be used.',
        );
    }
    const pathFromStoreRoot = join(sep, 'vendor', pkgName);
    return {
        name: themeName,
        vendor,
        themeID: normalizeComposerThemeName(vendor, themeName),
        area: area as Theme['area'],
        parentID: await getThemeParentName(join(root, pathFromStoreRoot)),
        pathFromStoreRoot: pathFromStoreRoot,
    };
}

function normalizeComposerThemeName(vendor: string, name: string) {
    // I have no clue if this is the logic used in Magento core,
    // but it's certainly a half-decent guess, yeah?
    const normalizedVendor = vendor
        .split('-')
        .map(v => `${v[0].toUpperCase()}${v.slice(1)}`)
        .join('');
    return `${normalizedVendor}/${name}`;
}

async function getModuleConfig(root: string, path: string): Promise<Module> {
    const configPath = join(root, path, 'etc', 'module.xml');
    const rawConfig = await fs.readFile(configPath, 'utf8');
    const parsedConfig = parse(rawConfig, {
        ignoreAttributes: false,
        attributeNamePrefix: '',
        ignoreNameSpace: true,
    });

    const config = {
        moduleID: parsedConfig.config.module.name as string,
        sequence: [] as string[],
        pathFromStoreRoot: join(sep, path),
    };
    const { sequence } = parsedConfig.config.module;

    if (!sequence) return config;

    if (Array.isArray(sequence.module)) {
        // multiple dependencies
        config.sequence = sequence.module.map((m: any) => m.name) as string[];
    } else {
        // single dependency (the xml parser is weird)
        config.sequence.push(sequence.module.name);
    }

    return config;
}

/**
 * @summary Provide contextful information about a file path within a theme
 */
export function parseThemePath(path: string, theme: Theme): ThemeAsset {
    const relPath = relative(theme.pathFromStoreRoot, path);
    // prettier-ignore
    const [firstDir, /* web */, ...rest] = relPath.split(sep);
    const isModuleContext = /^[a-z0-9]+_[a-z0-9]+$/i.test(firstDir);

    if (isModuleContext) {
        return {
            type: 'ThemeAsset',
            themeID: theme.themeID,
            moduleID: firstDir,
            pathFromStoreRoot: path,
            finalPath: join(firstDir, ...rest),
        };
    }

    return {
        type: 'ThemeAsset',
        themeID: theme.themeID,
        pathFromStoreRoot: path,
        finalPath: relative('web', relPath),
    };
}

export function parseModulePath(path: string, mod: Module): ModuleAsset {
    const viewDir = join(mod.pathFromStoreRoot, 'view');
    // prettier-ignore
    const [/*area*/, /* web */, ...rest] = relative(viewDir, path).split(sep);
    return {
        type: 'ModuleAsset',
        moduleID: mod.moduleID,
        pathFromStoreRoot: path,
        finalPath: join(mod.moduleID, ...rest),
    };
}

/**
 * @summary Wrapper around fs.readdir that _always_ returns an array
 */
async function safeDirRead(path: string) {
    return fs.readdir(path, 'utf8').catch(() => [] as string[]);
}

function assertAbsolute(path: string) {
    if (isAbsolute(path)) return;
    throw new Error(
        `Expected an absolute path for the store root, but instead saw: "${path}"`,
    );
}
