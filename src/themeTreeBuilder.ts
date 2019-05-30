/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

import { Theme } from './types';
import { readTree } from './readTree';
import {
    getThemeHierarchy,
    themeToPath,
    parseThemePath,
    themeFileToThemeless,
    StaticAsset,
    getEnabledModules,
    getModuleWebDir,
    parseModulePath,
    moduleAssetToThemePath,
    ModuleAsset,
} from './magentoFS';
import { wrapP } from './wrapP';

/**
 * @summary Builds an in-memory/serializable representation of
 * the final file tree for a deployed theme.
 */
export async function themeTreeBuilder(root: string, theme: Theme) {
    const [themeTree, moduleFiles] = await Promise.all([
        flattenThemeFiles(root, theme),
        collectModuleFiles(root, theme),
    ]);

    return {
        ...moduleFiles,
        ...themeTree,
    };
}

/**
 * @summary Implements the core business logic of *theme*
 * file fallback (not including accounting for locales).
 */
async function flattenThemeFiles(root: string, theme: Theme) {
    const hierarchy = await getThemeHierarchy(root, theme);
    const themeTrees = await Promise.all(
        hierarchy.map(curTheme => {
            // TODO: Kill the hacky string replacement at the end
            const relThemePath = themeToPath(root, curTheme).replace(root, '');
            // TODO: Should exclude any folders that aren't `web` when in module dirs
            return readTree(root, relThemePath, {
                // Hack for now to ignore dirs that aren't `web` in module contexts
                ignore: ['**/*.xml'],
            });
        }),
    );

    const flatTree: Record<string, StaticAsset> = {};
    for (const tree of themeTrees) {
        for (const file of tree) {
            const themeFile = parseThemePath(file);
            const finalPath = themeFileToThemeless(themeFile);
            // TODO: Track files that get inherited-over, for future diagnostics + tooling
            flatTree[finalPath] = themeFile;
        }
    }

    return flatTree;
}

/**
 * @summary Implements the core business logic of *module* file fallback.
 * // Does not handle the special-case situations (less, requirejs-config.js)
 */
async function collectModuleFiles(root: string, theme: Theme) {
    const enabledModules = await getEnabledModules(root);
    const entries: Record<string, ModuleAsset> = {};

    await Promise.all(
        enabledModules.map(async mod => {
            const path = await getModuleWebDir(root, mod, theme.area);
            const [, tree = new Set()] = await wrapP(readTree(root, path));
            for (const file of tree) {
                const moduleAsset = parseModulePath(file, mod);
                const pathInTheme = moduleAssetToThemePath(moduleAsset);
                entries[pathInTheme] = moduleAsset;
            }
        }),
    );

    return entries;
}
