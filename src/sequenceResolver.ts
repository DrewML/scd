import { ModuleConfig } from './types';
import TopologicalSort from '@hapi/topo';

export function sequenceResolver(configs: ModuleConfig[]) {
    const sort = new TopologicalSort();
    for (const config of configs) {
        sort.add(config, {
            group: config.name,
            after: config.sequence,
        });
    }

    return sort.nodes as string[];
}
