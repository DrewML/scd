/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

import { join, parse } from 'path';
import { StaticAssetTree, InMemoryAsset, CSSCompilationResult } from './types';
import Worker from 'jest-worker';
import { lessWorker } from './lessWorker';

const WORKER_PATH = require.resolve('./lessWorker');

/**
 * @summary Compile less styles in memory (does not write to disk)
 * @see https://devdocs.magento.com/guides/v2.3/frontend-dev-guide/css-topics/css-preprocess.html
 */
export async function compileLess(
    root: string,
    tree: StaticAssetTree,
): Promise<CSSCompilationResult> {
    // Create a smaller version of the tree with just .less files,
    // to prevent sending excessive data over the message channel
    // with the worker processes
    const lessTree: StaticAssetTree = {};
    // Any file in the top-level of the `css` dir in the theme is an entry point
    const entries: string[] = [];

    for (const [path, asset] of Object.entries(tree)) {
        const { ext, dir, name } = parse(path);
        if (ext !== '.less') continue;

        if (dir === 'css' && name[0] !== '_') {
            entries.push(path);
        }

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
