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
import { join, sep } from 'path';
import { readTree } from './readTree';
import { parseThemePath, parseModulePath } from './magentoFS';
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
            const pendingModuleCtxFiles = Promise.all(
                enabledModules.map(async m => {
                    const webDir = join(curTheme.pathFromStoreRoot, m, 'web');
                    try {
                        const files = await readTree(join(root, webDir));
                        return files.map(file => join(webDir, file));
                    } catch (e) {
                        return [];
                    }
                }),
            );

            // Theme files that override <root>/lib/web
            const webDir = join(curTheme.pathFromStoreRoot, 'web');
            const pendingWebFiles = (await readTree(join(root, webDir))).map(
                f => join(webDir, f),
            );

            return {
                theme: curTheme,
                files: [
                    ...flatten(await pendingModuleCtxFiles),
                    ...(await pendingWebFiles),
                ],
            };
        }),
    );

    const tree: Record<string, StaticAsset> = {};
    for (const themeTree of themeTrees) {
        for (const file of themeTree.files) {
            const themeFile = parseThemePath(file, themeTree.theme);
            tree[themeFile.finalPath] = themeFile;
        }
    }

    return tree;
}

/**
 * @summary Implements module file fallback for everything
 *          except less files and requirejs-config.js
 */
async function reduceModules(opts: Opts) {
    const { root, theme, enabledModules, components } = opts;
    const tree: Record<string, ModuleAsset> = {};

    await Promise.all(
        enabledModules.map(async moduleID => {
            const mod = components.modules[moduleID];
            const webPath = join(
                mod.pathFromStoreRoot,
                'view',
                theme.area,
                'web',
            );
            const webTree = await readTree(join(root, webPath)).catch(() => []);
            for (const file of webTree) {
                const pathFromRoot = join(webPath, file);
                const moduleAsset = parseModulePath(pathFromRoot, mod);
                tree[moduleAsset.finalPath] = moduleAsset;
            }
        }),
    );

    return tree;
}

/**
 * @summary Recursively collects all files in <root>/lib/web
 */
async function reduceLibWeb({ root }: Opts) {
    const webPath = join('lib', 'web');
    const files = await readTree(join(root, webPath));
    const tree: Record<string, StaticAsset> = {};
    for (const file of files) {
        const asset: RootAsset = {
            type: 'RootAsset',
            pathFromStoreRoot: join(sep, webPath, file),
            finalPath: file,
        };
        tree[asset.finalPath] = asset;
    }
    return tree;
}
