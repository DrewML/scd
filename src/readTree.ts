/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

import { promises as fs, Dirent } from 'fs';
import { join } from 'path';

/**
 * @summary Create a flat structure representing a recursive crawl of a directory
 */
export async function readTree(root: string, dir: string = '') {
    const tree: string[] = [];
    const entries = (await fs.readdir(join(root, dir), {
        // @ts-ignore node core types are lagging behind
        withFileTypes: true,
    })) as Dirent[];

    for (const entry of entries) {
        const path = join(dir, entry.name);

        if (entry.isFile()) {
            tree.push(path);
        }

        if (entry.isDirectory()) {
            const nestedEntries = await readTree(root, path);
            for (const e of nestedEntries) tree.push(e);
        }
    }

    return tree;
}
