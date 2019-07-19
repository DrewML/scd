/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

import { UserConfig } from './types';
import { promises as fs } from 'fs';
import { isAbsolute, join, parse } from 'path';
import { wrapP } from './wrapP';

/**
 * @summary Locate/validate/parse the `scd.json` configuration file. Starts
 *          at cwd and continues up until either a config is found, or "/" is hit.
 *          This enables running the `scd` command in any store directory
 */
export async function getConfig(
    searchPath: string,
): Promise<UserConfig | undefined> {
    if (!isAbsolute(searchPath)) {
        throw new Error(
            `Expected absolute path in getConfig, but got ${searchPath}`,
        );
    }
    const configPath = await findConfigPath(searchPath);
    if (!configPath) return;

    const rawConfig = await fs.readFile(configPath, 'utf8');
    return parseConfig(rawConfig);
}

async function findConfigPath(startPath: string): Promise<string | undefined> {
    const [, files = []] = await wrapP(fs.readdir(startPath));
    if (files.includes('scd.json')) return join(startPath, 'scd.json');

    const oneUp = join(startPath, '..');
    // TODO: Find out if this works on windows
    if (oneUp === parse(oneUp).root) {
        // Hit the root dir without finding a match
        return;
    }

    return findConfigPath(oneUp);
}

/**
 * @summary Validates that the config file matches the
 *          expected type. Might use JSON schema for this
 *          in the future, but this is _much_ faster for now
 */
function parseConfig(rawConfig: string): UserConfig {
    let config: UserConfig;
    try {
        config = JSON.parse(rawConfig) as UserConfig;
    } catch (err) {
        err.message = 'Invalid Config: Malformed JSON';
        throw err;
    }

    if (typeof config.storeRoot !== 'string') {
        throw new Error('Invalid config: "storeRoot" must be a string');
    }

    if (!Array.isArray(config.themes)) {
        throw new Error(
            'Invalid config: "themes" must be an array of themes/locales',
        );
    }

    config.themes.forEach(theme => {
        if (!theme.name) {
            throw new Error(
                'Invalid Config: All themes must have a "name" property',
            );
        }
        if (!Array.isArray(theme.locales)) {
            throw new Error(
                `Invalig Config: Must provide required locales for ${
                    theme.name
                }`,
            );
        }
    });

    return config;
}
