/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

import { UserConfig } from './types';
import { getComponents, getEnabledModules } from './magentoFS';
import { themeTreeBuilder } from './themeTreeBuilder';
import { generateRequireConfig } from './generateRequireConfig';
import { getThemeHierarchy } from './getThemeHierarchy';

export async function runBuild(config: UserConfig) {
    const [components, enabledModules] = await Promise.all([
        getComponents(config.storeRoot),
        getEnabledModules(config.storeRoot),
    ]);

    for (const theme of config.themes) {
        const currentTheme = components.themes[theme.name];
        const tree = await themeTreeBuilder({
            root: config.storeRoot,
            components,
            theme: currentTheme,
            enabledModules,
        });
        const sortedModules = enabledModules.map(m => components.modules[m]);
        const requireConfig = await generateRequireConfig(
            config.storeRoot,
            getThemeHierarchy(currentTheme, components.themes),
            sortedModules,
        );
        console.log(requireConfig);
        // build requirejs-config.js
        // build translation dicts
    }
}
