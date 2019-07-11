/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

import { UserConfig } from './types';
import { getComponents, getEnabledModules } from './magentoFS';
import { themeTreeBuilder } from './themeTreeBuilder';

export async function runBuild(config: UserConfig) {
    const [components, enabledModules] = await Promise.all([
        getComponents(config.storeRoot),
        getEnabledModules(config.storeRoot),
    ]);

    // TODO: Handle locales
    for (const theme of config.themes) {
        const tree = await themeTreeBuilder({
            root: config.storeRoot,
            components,
            // @ts-ignore
            theme: components.themes.find(t => t.themeID === theme.name),
            enabledModules,
        });
        // build requirejs-config.js
        // build translation dicts
    }
}
