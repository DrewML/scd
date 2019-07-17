/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

import { extname } from 'path';
import { StaticAssetTree } from './types';
import Worker from 'jest-worker';
import { compileLess as compileLessWorker } from './lessWorker';

const ENTRIES = ['css/styles-l.less', 'css/styles-m.less'];
const WORKER_PATH = require.resolve('./lessWorker');

/**
 * @summary Compile less styles in memory (does not write to disk)
 * @see https://devdocs.magento.com/guides/v2.3/frontend-dev-guide/css-topics/css-preprocess.html
 * @todo Create virtual files, remove less files from tree, return new tree with virtuals
 */
export async function compileLess(
    root: string,
    tree: StaticAssetTree,
    entries: string[] = ENTRIES,
): Promise<StaticAssetTree> {
    // Create a smaller version of the tree with just less files,
    // to prevent sending excessive data over the message channel
    // with the worker processes
    const lessTree: StaticAssetTree = {};
    for (const [path, asset] of Object.entries(tree)) {
        if (extname(path) !== '.less') continue;
        lessTree[path] = asset;
    }

    const worker = new Worker(WORKER_PATH);
    const compile = (worker as any).compileLess as typeof compileLessWorker;
    const results = await Promise.all(
        entries.map(entry => compile(root, lessTree, entry)),
    );

    worker.end();
    console.log(results);
}
