/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

import { Theme } from './types';
import { readTree } from './readTree';
import { getThemeHierarchy, themeToPath, parseThemePath } from './magentoFS';

/**
 * @summary Builds an in-memory/serializable representation of
 * the final file tree for a deployed theme.
 */
export async function themeTreeBuilder(root: string, theme: Theme) {
    const hierarchy = await getThemeHierarchy(root, theme);

    const trees = await Promise.all(
        hierarchy.map(curTheme => {
            const relThemePath = themeToPath(root, curTheme).replace(root, '');
            return readTree(root, relThemePath);
        }),
    );

    const flatTree: Record<string, string> = {};
    for (const tree of trees) {
        for (const file of tree) {
            const themeFile = parseThemePath(file);
            console.log(themeFile);
        }
    }
    return trees;
}
