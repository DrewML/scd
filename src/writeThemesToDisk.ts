/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

import { promises as fs, constants, mkdir } from 'fs';
import { promisify } from 'util';
import { isAbsolute, join, dirname } from 'path';
import { wrapP } from './wrapP';
import { StaticAssetTree, Theme, GeneratedAsset } from './types';
import rimraf from 'rimraf';

/**
 * @summary Write an asset tree + transformations to disk
 * @todo This will need to be refactored for multi-theme and i18n
 *       support, so we can symlink shared files to one common
 */
export async function writeThemesToDisk(
    root: string,
    theme: Theme,
    tree: StaticAssetTree,
    generatedAssets: GeneratedAsset[],
    filesToRemove: string[],
) {
    if (!isAbsolute(root)) {
        throw new Error(`root must be an absolute path. Received ${root}`);
    }

    const outDir = join(
        root,
        'pub',
        'static',
        theme.area,
        theme.vendor,
        theme.name,
        'en_US',
    );

    const [err] = await wrapP(fs.access(outDir));
    if (!err) {
        // rimraf can be slow, so we only try and clear the dir
        // if we know it exists
        await promisify(rimraf)(outDir, { glob: false });
    }

    const pendingThemeTreeWrites = Object.values(tree).map(async asset => {
        if (filesToRemove.includes(asset.finalPath)) return;

        const srcPath = join(root, asset.pathFromStoreRoot);
        const destPath = join(outDir, asset.finalPath);
        await fs.mkdir(dirname(destPath), { recursive: true });
        // use copy-on-write for file systems that support it
        await fs.copyFile(srcPath, destPath, constants.COPYFILE_FICLONE);
    });

    const pendingGeneratedWrites = generatedAssets.map(async asset => {
        if (asset.type === 'InMemoryAsset') {
            const destPath = join(outDir, asset.finalPath);
            await fs.mkdir(dirname(destPath), { recursive: true });
            await fs.writeFile(destPath, asset.source);
        }
    });

    await Promise.all([...pendingThemeTreeWrites, ...pendingGeneratedWrites]);
}
