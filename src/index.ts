/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

import { UserConfig } from './types';
import { getComponents, getEnabledModules } from './magentoFS';
import { themeTreeBuilder } from './themeTreeBuilder';
import { generateRequireConfig } from './generateRequireConfig';
import { compileLess } from './transformLess';
import { writeThemesToDisk } from './writeThemesToDisk';

/**
 * @summary Run a static content deployment for n themes/locales
 */
export async function runBuild(config: UserConfig) {
    const [components, enabledModules] = await Promise.all([
        getComponents(config.storeRoot),
        getEnabledModules(config.storeRoot),
    ]);

    // TODO: Start running (some) parts of theme processing in parallel
    for (const theme of config.themes) {
        const currentTheme = components.themes[theme.name];

        // Kick off require config generation immediately,
        // since it doesn't need to wait for the theme tree
        const pendingRequireConfig = generateRequireConfig(
            config.storeRoot,
            currentTheme,
            components,
            enabledModules,
        );

        const tree = await themeTreeBuilder({
            root: config.storeRoot,
            components,
            theme: currentTheme,
            enabledModules,
        });

        const [cssResults, requireConfig] = await Promise.all([
            compileLess(config.storeRoot, tree),
            pendingRequireConfig,
        ]);

        // Note: Write themes to disk only supports 1 theme right now.
        // But, it will take multiple themes and be moved outside this loop.
        // See todo in writeThemesToDisk.md
        await writeThemesToDisk(
            config.storeRoot,
            currentTheme,
            tree,
            [...cssResults.filesToAdd, requireConfig],
            cssResults.filesToRemove,
        );
    }
}
