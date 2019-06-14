/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

import { promises as fs, Dirent } from 'fs';
import { join } from 'path';

/**
 * Create a flat structure representing a recursive crawl of a directory
 */
export async function readTree(root: string, dir: string) {
    const flatTree: string[] = [];
    const entries = (await fs.readdir(join(root, dir), {
        // @ts-ignore node core types are lagging behind
        withFileTypes: true,
    })) as Dirent[];

    for (const entry of entries) {
        const path = join(dir, entry.name);

        if (entry.isFile()) {
            flatTree.push(path);
        }

        if (entry.isDirectory()) {
            const nestedEntries = await readTree(root, path);
            for (const e of nestedEntries) flatTree.push(e);
        }
    }

    return flatTree;
}
