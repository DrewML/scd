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
import { join } from 'path';
import { readTree } from './readTree';
import {
    parseThemePath,
    parseModulePath,
    finalPathFromStaticAsset,
} from './magentoFS';
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
            const webDir = join(curTheme.pathFromStoreRoot, 'web');
            // Only check for files in enabled modules
            const moduleWebDirs = enabledModules.map(m =>
                join(curTheme.pathFromStoreRoot, m, 'web'),
            );

            // Non-front-end stuff can exist in a theme directory,
            // and a module dir within a theme. To prevent dealing
            // with non-FE files, and to prevent copying code
            // for disabled modules, we don't read the entire theme
            // dir, but instead do a read of each module dir
            // and the /web/ dir
            const pendingNestedFiles = Promise.all(
                moduleWebDirs.map(async m => {
                    try {
                        // TODO: Maybe just make `readTree` a safe operation
                        // like safeDirRead in magentoFS.ts
                        return await readTree(root, m);
                    } catch {
                        // module was enabled, but does not have a /web/ folder
                        return [];
                    }
                }),
            );
            const pendingWebFiles = readTree(root, webDir);

            return {
                theme: curTheme,
                files: [
                    ...flatten(await pendingNestedFiles),
                    ...(await pendingWebFiles),
                ],
            };
        }),
    );

    const flatTree: Record<string, StaticAsset> = {};
    for (const tree of themeTrees) {
        for (const file of tree.files) {
            const themeFile = parseThemePath(file, tree.theme);
            const finalPath = finalPathFromStaticAsset(themeFile, components);
            flatTree[finalPath] = themeFile;
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
        enabledModules.map(async mod => {
            const path = join(
                components.modules[mod].pathFromStoreRoot,
                'view',
                theme.area,
                'web',
            );
            const [, tree = new Set<string>()] = await wrapP(
                readTree(root, path),
            );
            for (const file of tree) {
                const moduleAsset = parseModulePath(file, mod);
                const pathInTheme = finalPathFromStaticAsset(
                    moduleAsset,
                    components,
                );
                entries[pathInTheme] = moduleAsset;
            }
        }),
    );

    return entries;
}

async function reduceLibWeb(opts: Opts) {
    const flatTree: Record<string, StaticAsset> = {};
    // TODO: No working with direct file paths outside of magentoFS.ts
    const files = await readTree(opts.root, join('lib', 'web'));
    for (const file of files) {
        const asset: RootAsset = {
            type: 'RootAsset',
            pathFromStoreRoot: join('/', file),
        };
        const finalPath = finalPathFromStaticAsset(asset, opts.components);
        flatTree[finalPath] = asset;
    }
    return flatTree;
}
