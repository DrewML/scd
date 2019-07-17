/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

import { runBuild } from '.';
import { getConfig } from './getConfig';
import { getComponents, isMagentoRoot } from './magentoFS';
import { promises as fs } from 'fs';
import { join } from 'path';
import c from 'chalk';

/**
 * @summary Execute the CLI
 */
export async function run(configPath: string = process.cwd()) {
    const config = await getConfig(configPath);
    if (config) {
        await runBuild(config);
        return;
    }

    await exitIfNotStoreRoot(configPath);

    // Fail where we don't have an a config, and we
    // don't have an interactive shell.
    // Example: Continuous integration servers
    if (!process.stdout.isTTY) {
        throw new Error('Could not locate config file "scd.json"');
    }

    await setupWizard(configPath);
}

/**
 * @summary Gather data about the store, ask some questions,
 *          and write a default config file to disk
 * @todo    Suggest locales from installed language packs, instead
 *          of hardcoding en_US
 */
async function setupWizard(root: string) {
    const { themes } = await getComponents(root);
    const answer = await getLazyLoadedInquirer().prompt([
        {
            type: 'checkbox',
            name: 'themes',
            message: 'Select the themes you commonly deploy',
            choices: Object.values(themes).map(t => t.themeID),
            default: ['Magento/backend', 'Magento/luma'],
            validate: a => a.length > 0 || 'Must select at least one theme',
        },
    ]);
    const config = {
        storeRoot: root,
        // @ts-ignore
        themes: answer.themes.map(t => ({ name: t, locales: ['en_US'] })),
    };
    const configPath = join(root, 'scd.json');
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
    console.log(c.green(`Wrote scd configuration to "${configPath}".`));
}

/**
 * @summary Warn and exit the process if provided dir
 *          is not the root of a Magento store
 */
async function exitIfNotStoreRoot(root: string) {
    if (!(await isMagentoRoot(root))) {
        console.log(
            c.red(
                'Could not locate config file or determine the ' +
                    'store root directory. Please run "scd" from the ' +
                    'root directory of the store',
            ),
        );
        process.exit(0);
    }
}

/**
 * @summary The inquirer module has side-effects upon import that eat
 *          up ~30ms of app start time. Lazy load it so we don't pay
 *          that cost when we're not using it
 */
function getLazyLoadedInquirer() {
    type Inquirer = typeof import('inquirer');
    return require('inquirer') as Inquirer;
}
