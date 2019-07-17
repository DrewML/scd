/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

import { UserConfig } from './types';
import { getComponents, getEnabledModules } from './magentoFS';
import { themeTreeBuilder } from './themeTreeBuilder';
import { generateRequireConfig } from './generateRequireConfig';
import { compileLess } from './transformLess';

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
        const requireConfig = await generateRequireConfig(
            config.storeRoot,
            currentTheme,
            components,
            enabledModules,
        );
        // console.log(requireConfig);
        const css = await compileLess(config.storeRoot, tree);
        console.log(css);
        // build translation dicts
    }
}
