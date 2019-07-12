/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

import { join } from 'path';
import { promises as fs } from 'fs';
import { flatten } from './flatten';
import { Theme, Module } from './types';

const FILE_NAME = 'requirejs-config.js';
/**
 * @summary Generate a combined RequireJS config file
 * @see https://devdocs.magento.com/guides/v2.3/javascript-dev-guide/javascript/js-resources.html#m2devgde-js-resources-mapping
 */
export async function generateRequireConfig(
    root: string,
    themeHierarchy: Theme[],
    modules: Module[],
) {
    const [moduleConfigs, themeConfigs] = await Promise.all([
        getConfigsFromModules(root, themeHierarchy, modules),
        getConfigsFromThemes(root, themeHierarchy),
    ]);

    return compileConfigs(moduleConfigs.concat(themeConfigs));
}

/**
 * @summary Find all RequireJS configs for enabled modules
 */
async function getConfigsFromModules(
    root: string,
    themeHierarchy: Theme[],
    modules: Module[],
) {
    const configPath = (dir: string, area: string) => {
        return join(dir, 'view', area, FILE_NAME);
    };
    const [theme] = themeHierarchy.slice(-1);
    const pendingConfigs = modules.map(async mod => {
        const areaPath = configPath(mod.pathFromStoreRoot, theme.area);
        const basePath = configPath(mod.pathFromStoreRoot, 'base');

        const [areaConfig, baseConfig] = await Promise.all([
            safeReadFile(join(root, areaPath)),
            safeReadFile(join(root, basePath)),
        ]);

        return [
            { source: areaConfig, pathFromStoreRoot: areaPath },
            { source: baseConfig, pathFromStoreRoot: basePath },
        ];
    });

    return flatten(await Promise.all(pendingConfigs));
}

/**
 * @summary Find all RequireJS configs for current theme
 *          and all ancestor themes. Note that, for "module context"
 *          configs (Vendor_Module), only the `Magento_Theme` dir is supported
 */
async function getConfigsFromThemes(root: string, themeHierarchy: Theme[]) {
    const pendingMagentoThemeCtxConfigs = themeHierarchy.map(async t => {
        const path = join(t.pathFromStoreRoot, 'Magento_Theme', FILE_NAME);
        const source = await safeReadFile(join(root, path));
        return { source, pathFromStoreRoot: path };
    });

    const pendingThemeRootConfigs = themeHierarchy.map(async t => {
        const path = join(t.pathFromStoreRoot, FILE_NAME);
        const source = await safeReadFile(join(root, path));
        return { source, pathFromStoreRoot: path };
    });

    return Promise.all([
        ...pendingMagentoThemeCtxConfigs,
        ...pendingThemeRootConfigs,
    ]);
}

type RequireConfig = {
    source: string;
    pathFromStoreRoot: string;
};

/**
 * @summary Combine all configs into a single asset,
 *          copying IIFE-wrapping from Magento core implementation
 */
function compileConfigs(configs: RequireConfig[]): string {
    return configs.reduce((output, conf) => {
        if (!conf.source) return output;
        const str = `(function() {
    /* Source: ${conf.pathFromStoreRoot} */
    ${conf.source}
    require.config(config);
});\n\n`;
        return output + str;
    }, '');
}

/**
 * @summary Reads a file, and returns the provided default value
 *          when the file can't be accessed
 */
const safeReadFile = (path: string) =>
    fs.readFile(path, 'utf8').catch(() => '');
