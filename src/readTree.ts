/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

import { promises as fs, Dirent } from 'fs';
import { join } from 'path';
import micromatch from 'micromatch';

type Opts = {
    ignore?: string[];
};
/**
 * Create a flat structure representing a recursive crawl of a directory
 */
export async function readTree(root: string, dir: string, opts: Opts = {}) {
    const flatTree: Set<string> = new Set();
    const entries = (await fs.readdir(join(root, dir), {
        // @ts-ignore node core types are lagging behind
        withFileTypes: true,
    })) as Dirent[];

    for (const entry of entries) {
        const path = join(dir, entry.name);

        // @ts-ignore micromatch types are out of date
        if (opts.ignore && micromatch.isMatch(path, opts.ignore)) {
            // Short-circuit the loop (as opposed to running after the loop)
            // so we don't end up wasting time crawling ignored directories
            continue;
        }

        if (entry.isFile()) {
            flatTree.add(path);
        }

        if (entry.isDirectory()) {
            const nestedEntries = await readTree(root, path, opts);
            for (const e of nestedEntries) flatTree.add(e);
        }
    }

    return flatTree;
}
