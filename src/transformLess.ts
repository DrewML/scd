/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

import { extname, join, parse } from 'path';
import { StaticAssetTree, InMemoryAsset, CSSCompilationResult } from './types';
import Worker from 'jest-worker';
import { lessWorker } from './lessWorker';

const ENTRIES = ['css/styles-l.less', 'css/styles-m.less'];
const WORKER_PATH = require.resolve('./lessWorker');

/**
 * @summary Compile less styles in memory (does not write to disk)
 * @see https://devdocs.magento.com/guides/v2.3/frontend-dev-guide/css-topics/css-preprocess.html
 */
export async function compileLess(
    root: string,
    tree: StaticAssetTree,
    entries: string[] = ENTRIES,
): Promise<CSSCompilationResult> {
    // Create a smaller version of the tree with just .less files,
    // to prevent sending excessive data over the message channel
    // with the worker processes
    const lessTree: StaticAssetTree = {};
    for (const [path, asset] of Object.entries(tree)) {
        if (extname(path) !== '.less') continue;
        lessTree[path] = asset;
    }

    const worker = new Worker(WORKER_PATH);
    const compile = (worker as any).lessWorker as typeof lessWorker;
    const filesToAdd = await Promise.all(
        entries.map(async entry => {
            const p = parse(entry);
            const finalPath = join(p.dir, `${p.name}.css`);
            return {
                type: 'InMemoryAsset',
                // TODO: Sourcemap stuff when work is done in lessWorker.ts
                source: (await compile(root, lessTree, entry)).css,
                finalPath,
            } as InMemoryAsset;
        }),
    );

    worker.end();

    return {
        filesToRemove: Object.keys(lessTree),
        filesToAdd,
    };
}
