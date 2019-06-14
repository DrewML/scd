/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

import {
    Theme,
    StaticAsset,
    ModuleAsset,
    StaticAssetTree,
    RootAsset,
} from './types';
import { join } from 'path';
import { readTree } from './readTree';
import {
    themeToPath,
    parseThemePath,
    parseModulePath,
    finalPathFromStaticAsset,
    getEnabledModules,
    getModuleWebDir,
    getThemeHierarchy,
} from './magentoFS';
import { wrapP } from './wrapP';
import { flatten } from './flatten';

/**
 * @summary Builds an in-memory/serializable representation of
 * the final file tree for a deployed theme.
 * @see https://devdocs.magento.com/guides/v2.3/frontend-dev-guide/themes/theme-inherit.html
 */
export async function themeTreeBuilder(
    root: string,
    theme: Theme,
): Promise<StaticAssetTree> {
    const enabledModules = await getEnabledModules(root);
    const [themeTree, moduleFiles, libWebFiles] = await Promise.all([
        flattenThemeFiles(root, theme, enabledModules),
        flattenModuleFiles(root, theme, enabledModules),
        flattenLibWeb(root),
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
 * @todo Support for i18n dir
 */
async function flattenThemeFiles(
    root: string,
    theme: Theme,
    enabledModules: string[],
) {
    const hierarchy = await getThemeHierarchy(root, theme);
    const themeTrees = await Promise.all(
        hierarchy.map(async curTheme => {
            // TODO: Kill the hacky string replacement at the end
            const relThemePath = themeToPath(root, curTheme).replace(root, '');
            const webDir = join(relThemePath, 'web');
            // Only check for files in enabled modules
            const moduleWebDirs = enabledModules.map(m =>
                join(relThemePath, m, 'web'),
            );

            // Non-front-end stuff can exist in a theme directory,
            // and a module dir within a theme. To prevent dealing
            // with non-FE files, and to prevent copying code
            // for disabled modules, we don't read the entire theme
            // dir, but instead do a read of each module and the /web/ dir

            const nestedFiles = await Promise.all(
                moduleWebDirs.map(async m => {
                    try {
                        return await readTree(root, m);
                    } catch {
                        // module was enabled, but does not have a /web/ folder
                        return [];
                    }
                }),
            );

            return [...flatten(nestedFiles), ...(await readTree(root, webDir))];
        }),
    );

    const flatTree: Record<string, StaticAsset> = {};
    for (const tree of themeTrees) {
        for (const file of tree) {
            const themeFile = parseThemePath(file);
            const finalPath = finalPathFromStaticAsset(themeFile);
            // TODO: Track files that get inherited-over, for future diagnostics + tooling
            flatTree[finalPath] = themeFile;
        }
    }

    return flatTree;
}

/**
 * @summary Implements the core business logic of *module* file fallback.
 *          Does not handle the special-case situations (less, requirejs-config.js)
 */
async function flattenModuleFiles(
    root: string,
    theme: Theme,
    enabledModules: string[],
) {
    const entries: Record<string, ModuleAsset> = {};

    await Promise.all(
        enabledModules.map(async mod => {
            const path = await getModuleWebDir(root, mod, theme.area);
            const [, tree = new Set<string>()] = await wrapP(
                readTree(root, path),
            );
            for (const file of tree) {
                const moduleAsset = parseModulePath(file, mod);
                const pathInTheme = finalPathFromStaticAsset(moduleAsset);
                entries[pathInTheme] = moduleAsset;
            }
        }),
    );

    return entries;
}

async function flattenLibWeb(root: string) {
    const flatTree: Record<string, StaticAsset> = {};
    // TODO: No working with direct file paths outside of magentoFS.ts
    const files = await readTree(join(root, 'lib'), 'web');
    for (const file of files) {
        const asset: RootAsset = {
            type: 'RootAsset',
            pathFromStoreRoot: file,
        };
        const finalPath = finalPathFromStaticAsset(asset);
        flatTree[finalPath] = asset;
    }
    return flatTree;
}
