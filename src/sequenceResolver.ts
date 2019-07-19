/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

import { Module } from './types';
import TopologicalSort from '@hapi/topo';

/**
 * @summary Perform a topological sort on Magento modules
 */
export function sequenceResolver(configs: Module[]) {
    const sort = new TopologicalSort();
    for (const config of configs) {
        sort.add(config, {
            group: config.moduleID,
            after: config.sequence,
        });
    }

    return sort.nodes as string[];
}
