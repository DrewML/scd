/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

import { promises as fs } from 'fs';
import { isAbsolute, join } from 'path';
import { wrapP } from './wrapP';
import { Theme } from './types';
import { flatten } from './flatten';

/**
 * @summary Parses config.php to find a list of enabled modules
 * @see https://devdocs.magento.com/guides/v2.3/config-guide/config/config-php.html
 */
const CONFIG_PATH = 'app/etc/config.php';
export async function getEnabledModules(root: string) {
    assertAbsolute(root);
    const path = join(root, CONFIG_PATH);
    const [err, raw] = await wrapP(fs.readFile(path, 'utf8'));
    if (err) {
        throw new Error(`Failed reading Magento config.php at ${path}`);
    }

    const enabledModules = new Set<string>();
    for (const line of raw!.split('\n')) {
        // Note: Attempting to get away with a RegExp here instead
        // of a full-blown parser. config.php is code-gen'd, so
        // the format _should_ be consistent
        const matches = line.match(/^\s*'(\w+)'\s*=>\s*(\d)/);
        if (!matches) continue;

        const [, moduleName, enabled] = matches;
        if (Number(enabled)) enabledModules.add(moduleName);
    }

    return enabledModules;
}

/**
 * @summary Finds all modules in app/code and app/vendor, regardless
 * of whether or not they are enabled
 */
export async function getModulesOnDisk(root: string) {
    assertAbsolute(root);
    const [firstPartyVendors, thirdPartyVendors] = await Promise.all([
        safeDirRead(join(root, 'app/code')),
        safeDirRead(join(root, 'app/vendor')),
    ]);

    const modulesForVendors = (vendors: string[], dir: string) =>
        Promise.all(
            vendors.map(async vendor => {
                const modules = await safeDirRead(join(root, dir, vendor));
                return modules.map(mod => `${vendor}_${mod}`);
            }),
        );

    const [firstPartyModules, thirdPartyModules] = await Promise.all([
        modulesForVendors(firstPartyVendors, 'app/code'),
        modulesForVendors(thirdPartyVendors, 'app/vendor'),
    ]);

    return flatten([...firstPartyModules, ...thirdPartyModules]);
}

/**
 * @summary Finds all themes for both front-end and back-end.
 * Themes are included regardless of whether or not they're used
 */
export async function getThemes(root: string): Promise<Theme[]> {
    assertAbsolute(root);
    const areas = {
        frontend: join(root, 'app/design/frontend'),
        adminhtml: join(root, 'app/design/adminhtml'),
    };

    const frontendVendors = await fs.readdir(areas.frontend);
    const adminVendors = await fs.readdir(areas.adminhtml);

    const themesForVendors = (vendors: string[], area: keyof typeof areas) =>
        Promise.all(
            vendors.map(async vendor => {
                const themes = await fs.readdir(join(areas[area], vendor));
                return themes.map(name => ({ name, vendor, area }));
            }),
        );

    const [frontendThemes, adminThemes] = await Promise.all([
        themesForVendors(frontendVendors, 'frontend'),
        themesForVendors(adminVendors, 'adminhtml'),
    ]);

    return flatten([...frontendThemes, ...adminThemes]);
}

/**
 * @summary Determine which (if any) theme a given theme inherits from
 */
export async function getThemeParent(root: string, theme: Theme) {
    assertAbsolute(root);
    const themeXMLPath = join(
        root,
        'app/design',
        theme.area,
        theme.vendor,
        theme.name,
        'theme.xml',
    );
    const source = await fs.readFile(themeXMLPath, 'utf8');
    // Note: Skipping a full blown XML parser (for now) to maintain
    // speed and not take on an extra dep
    const [, parent = ''] = source.match(/<parent>(.+)<\/parent>/) || [];

    if (parent) {
        const [vendor, name] = parent.split('/');
        return { name, vendor, area: theme.area };
    }
}

function assertAbsolute(path: string) {
    if (isAbsolute(path)) return;
    throw new Error(
        `Expected an absolute path for the store root, but instead saw: "${path}"`,
    );
}

/**
 * @summary Wrapper around fs.readdir that _always_ returns an array
 */
async function safeDirRead(path: string) {
    try {
        return await fs.readdir(path);
    } catch {
        return [];
    }
}
