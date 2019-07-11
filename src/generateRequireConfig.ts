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
 * @summary Generate a combined RequireJS config file. Unlike the typical
 *          file fallback which replaces, require configs are appended
 * @see https://devdocs.magento.com/guides/v2.3/javascript-dev-guide/javascript/js-resources.html#m2devgde-js-resources-mapping
 */
export async function generateRequireConfig(
    root: string,
    themeHierarchy: Theme[],
    modules: Module[],
) {
    const [theme] = themeHierarchy.slice(-1);
    const configPath = (dir: string, area: string) => {
        return join(dir, 'view', area, FILE_NAME);
    };
    const safeReadFromRoot = (p: string) =>
        fs.readFile(join(root, p), 'utf8').catch(() => '');

    const pendingModuleConfigs = Promise.all(
        modules.map(async mod => {
            const areaPath = configPath(mod.pathFromStoreRoot, theme.area);
            const basePath = configPath(mod.pathFromStoreRoot, 'base');

            const [areaConfig, baseConfig] = await Promise.all([
                safeReadFromRoot(areaPath),
                safeReadFromRoot(basePath),
            ]);

            return [
                { source: areaConfig, pathFromStoreRoot: areaPath },
                { source: baseConfig, pathFromStoreRoot: basePath },
            ];
        }),
    );

    const pendingMagentoThemeCtxConfigs = Promise.all(
        themeHierarchy.map(async t => {
            const path = join(t.pathFromStoreRoot, 'Magento_Theme', FILE_NAME);
            const config = await safeReadFromRoot(path);
            return { source: config, pathFromStoreRoot: path };
        }),
    );

    const pendingThemeRootConfigs = Promise.all(
        themeHierarchy.map(async t => {
            const path = join(t.pathFromStoreRoot, FILE_NAME);
            const config = await safeReadFromRoot(path);
            return { source: config, pathFromStoreRoot: path };
        }),
    );

    const moduleConfigs = flatten(await pendingModuleConfigs);
    const [magentoThemeCtxConfigs, themeRootConfigs] = await Promise.all([
        pendingMagentoThemeCtxConfigs,
        pendingThemeRootConfigs,
    ]);

    const orderedConfigs = moduleConfigs.concat(
        magentoThemeCtxConfigs,
        themeRootConfigs,
    );
    return orderedConfigs.reduce((output, conf) => {
        if (!conf.source) return output;
        const str = `(function() {
    /* Source: ${conf.pathFromStoreRoot} */
    ${conf.source}
    require.config(config);
});\n\n`;
        return output + str;
    }, '');
}
