/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

import {
    StaticAsset,
    ModuleAsset,
    StaticAssetTree,
    RootAsset,
    Theme,
    Components,
} from './types';
import { join, sep, relative } from 'path';
import { readTree } from './readTree';
import { parseThemePath, parseModulePath } from './magentoFS';
import { wrapP } from './wrapP';
import { flatten } from './flatten';
import { getThemeHierarchy } from './getThemeHierarchy';

type Opts = {
    root: string;
    theme: Theme;
    components: Components;
    enabledModules: string[];
};

/**
 * @summary Builds an in-memory/serializable representation of
 * the flattened theme, including files needing
 * processing (requirejs-config, .less, etc)
 * @see https://devdocs.magento.com/guides/v2.3/frontend-dev-guide/themes/theme-inherit.html
 */
export async function themeTreeBuilder(opts: Opts): Promise<StaticAssetTree> {
    const [themeTree, moduleFiles, libWebFiles] = await Promise.all([
        reduceThemes(opts),
        reduceModules(opts),
        reduceLibWeb(opts),
    ]);

    return {
        ...libWebFiles,
        ...moduleFiles,
        ...themeTree,
    };
}

/**
 * @summary Implements the core business logic of *theme*
 * file fallback (not including accounting for locales).
 */
async function reduceThemes(opts: Opts) {
    const { root, enabledModules, components } = opts;
    const hierarchy = getThemeHierarchy(opts.theme, components.themes);
    const themeTrees = await Promise.all(
        hierarchy.map(async curTheme => {
            // Themes can have assets for modules
            // that are disabled, so we read only from
            // dirs of modules enabled in config.php
            const enabledModulesDirs = enabledModules.map(m =>
                join(curTheme.pathFromStoreRoot, m, 'web'),
            );
            const pendingModuleCtxFiles = Promise.all(
                enabledModulesDirs.map(m => readTree(root, m).catch(() => [])),
            );

            // Theme files that override <root>/lib/web
            const webDir = join(curTheme.pathFromStoreRoot, 'web');
            const pendingWebFiles = readTree(root, webDir);

            return {
                theme: curTheme,
                files: [
                    ...flatten(await pendingModuleCtxFiles),
                    ...(await pendingWebFiles),
                ],
            };
        }),
    );

    const flatTree: Record<string, StaticAsset> = {};
    for (const tree of themeTrees) {
        for (const file of tree.files) {
            const themeFile = parseThemePath(file, tree.theme);
            flatTree[themeFile.finalPath] = themeFile;
        }
    }

    return flatTree;
}

/**
 * @summary Implements the core business logic of *module* file fallback.
 *          Does not handle the special-case situations (less, requirejs-config.js)
 */
async function reduceModules(opts: Opts) {
    const { root, theme, enabledModules, components } = opts;
    const entries: Record<string, ModuleAsset> = {};

    await Promise.all(
        enabledModules.map(async moduleID => {
            const mod = components.modules[moduleID];
            const path = join(mod.moduleID, 'view', theme.area, 'web');
            const [, tree = new Set<string>()] = await wrapP(
                readTree(root, path),
            );
            for (const file of tree) {
                const moduleAsset = parseModulePath(file, mod);
                entries[moduleAsset.finalPath] = moduleAsset;
            }
        }),
    );

    return entries;
}

async function reduceLibWeb(opts: Opts) {
    const flatTree: Record<string, StaticAsset> = {};
    const path = join(sep, 'lib', 'web');
    const files = await readTree(opts.root, path);
    for (const file of files) {
        const asset: RootAsset = {
            type: 'RootAsset',
            pathFromStoreRoot: join('/', file),
            finalPath: relative(path, file),
        };
        flatTree[asset.finalPath] = asset;
    }
    return flatTree;
}
