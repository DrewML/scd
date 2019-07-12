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
 * processing (requirejs-config, .less, etc). Excludes
 * any non-frontend assets (layout, phtml templates, etc)
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
 * @summary Theme file fallback
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
                enabledModules.map(m => {
                    const webDir = join(curTheme.pathFromStoreRoot, m, 'web');
                    // Swallow read errors on purpose - modules are not
                    // required to have a `web` dir
                    return readTree(root, webDir).catch(() => []);
                }),
            );

            // Theme files that override <root>/lib/web
            const webDir = join(curTheme.pathFromStoreRoot, 'web');
            const pendingWebFiles = await readTree(root, webDir);

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
 * @summary Module file fallback
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
            // modules have a special area "base" that has a
            // lower priority than the current area (frontend/adminhtml)
            const baseWebPath = join(
                mod.pathFromStoreRoot,
                'view',
                'base',
                'web',
            );
            const [webTree, baseWebTree] = await Promise.all([
                readTree(root, webPath).catch(() => []),
                readTree(root, baseWebPath).catch(() => []),
            ]);
            for (const file of [...baseWebTree, ...webTree]) {
                const moduleAsset = parseModulePath(file, mod);
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
