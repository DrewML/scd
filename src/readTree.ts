/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

import { promises as fs, Dirent } from 'fs';
import { join } from 'path';

export async function readTree(root: string, dir: string) {
    const flatTree: Set<string> = new Set();
    const entries = (await fs.readdir(join(root, dir), {
        // @ts-ignore node core types are lagging behind
        withFileTypes: true,
    })) as Dirent[];

    for (const entry of entries) {
        if (entry.isFile()) {
            const path = join(dir, entry.name);
            flatTree.add(path);
        }

        if (entry.isDirectory()) {
            const dirPath = join(dir, entry.name);
            const nestedEntries = await readTree(root, dirPath);
            for (const e of nestedEntries) flatTree.add(e);
        }
    }

    return flatTree;
}
