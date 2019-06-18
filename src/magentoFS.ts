/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

import { promises as fs } from 'fs';
import { isAbsolute, join, relative, sep } from 'path';
import { wrapP } from './wrapP';
import {
    ThemeAsset,
    ModuleAsset,
    StaticAsset,
    ModuleNew,
    ThemeNew,
    Components,
} from './types';
import { flatten } from './flatten';
import { parse } from 'fast-xml-parser';
import fromEntries from 'fromentries';

// Fix this, because themes can be in vendor
const THEME_ROOT = 'app/design';

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
    // modules are typically referenced by their ID (Magento_Foo),
    // and we do these lookups in some hot, nested loops, so we're
    // eating the cost here for O(1) lookups later
    const modulesByName = fromEntries(allModules.map(m => [m.moduleID, m]));

    return {
        modules: modulesByName,
        themes: [...composer.themes, ...nonComposer.themes],
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
    const lockfile = await fs.readFile(join(root, 'composer.lock'), 'utf8');
    const composerLock = JSON.parse(lockfile) as ComposerLock;

    const pendingModules: Promise<ModuleNew>[] = [];
    const pendingThemes: Promise<ThemeNew>[] = [];

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
    assertAbsolute(root);
    const [modules, themes] = await Promise.all([
        getNonComposerModules(root),
        getNonComposerThemes(root),
    ]);
    return { modules, themes };
}

async function getNonComposerThemes(root: string) {
    const [frontendVendors, adminVendors] = await Promise.all([
        fs.readdir(join(root, 'app', 'design', 'adminhtml')),
        fs.readdir(join(root, 'app', 'design', 'adminhtml')),
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
    area: ThemeNew['area'],
): Promise<ThemeNew[]> {
    const vendorPath = join('app', 'design', area, vendor);
    const themes = await fs.readdir(join(root, vendorPath), 'utf8');
    return Promise.all(
        themes.map(async name => ({
            name,
            vendor,
            normalizedName: `${vendor}/${name}`,
            area,
            parentID: await getThemeParentName(root, join(vendorPath, name)),
            pathFromStoreRoot: join(sep, 'app', 'design', area, vendor, name),
        })),
    );
}

async function getThemeParentName(root: string, themePath: string) {
    const themeXMLPath = join(root, themePath, 'theme.xml');
    const [err, source] = await wrapP(fs.readFile(themeXMLPath, 'utf8'));
    if (err) {
        throw new Error(`Could not find "theme.xml in "${themeXMLPath}"`);
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
): Promise<ThemeNew> {
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
        normalizedName: normalizeComposerThemeName(vendor, themeName),
        area: area as ThemeNew['area'],
        parentID: await getThemeParentName(root, pathFromStoreRoot),
        pathFromStoreRoot: pathFromStoreRoot,
    };
}

function normalizeComposerThemeName(vendor: string, name: string) {
    const normalizedVendor = vendor
        .split('-')
        .map(v => `${v[0].toUpperCase()}${v.slice(1)}`)
        .join('');
    return `${normalizedVendor}/${name}`;
}

async function getModuleConfig(root: string, path: string): Promise<ModuleNew> {
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

function assertAbsolute(path: string) {
    if (isAbsolute(path)) return;
    throw new Error(
        `Expected an absolute path for the store root, but instead saw: "${path}"`,
    );
}

/**
 * @summary Provide contextful information about a file path within a theme
 * @todo Make compatible with composer packages
 */
export function parseThemePath(path: string, theme: ThemeNew): ThemeAsset {
    const relPath = relative(theme.pathFromStoreRoot, path);
    const [firstDir] = relPath.split(sep);
    const isModuleContext = /^[a-z0-9]+_[a-z0-9]+$/i.test(firstDir);
    if (isModuleContext) {
        return {
            type: 'ThemeAsset',
            theme,
            moduleID: firstDir,
            pathFromStoreRoot: path,
        };
    }

    return { type: 'ThemeAsset', theme, pathFromStoreRoot: path };
}

export function parseModulePath(
    path: string,
    moduleContext: string,
): ModuleAsset {
    return {
        type: 'ModuleAsset',
        moduleID: moduleContext,
        pathFromStoreRoot: join('/', path),
    };
}

export function finalPathFromStaticAsset(
    asset: StaticAsset,
    components: Components,
) {
    switch (asset.type) {
        case 'RootAsset':
            return relative(join(sep, 'lib', 'web'), asset.pathFromStoreRoot);
        case 'ThemeAsset': {
            if (asset.moduleID) {
                // ex: /web/css/source/module/checkout/_checkout-agreements.less
                const afterModule = asset.pathFromStoreRoot.split(
                    asset.moduleID,
                )[1];
                // ex: css/source/module/checkout/_checkout-agreements.less
                const afterWebDir = relative(join(sep, 'web'), afterModule);
                return join(asset.moduleID, afterWebDir);
            }

            const pathChunks = asset.pathFromStoreRoot.split(sep);
            const firstWebDirIdx = pathChunks.findIndex(p => p === 'web');
            const afterWebDir = pathChunks.slice(firstWebDirIdx + 1).join(sep);
            return afterWebDir;
        }
        case 'ModuleAsset': {
            return join(
                asset.moduleID,
                relative(
                    join(
                        components.modules[asset.moduleID].pathFromStoreRoot,
                        'view',
                        'frontend', // TODO: Can't hardcode area
                        'web',
                    ),
                    asset.pathFromStoreRoot,
                ),
            );
        }
    }
}

/**
 * @summary Wrapper around fs.readdir that _always_ returns an array
 */
async function safeDirRead(path: string) {
    return fs.readdir(path, 'utf8').catch(() => [] as string[]);
}
