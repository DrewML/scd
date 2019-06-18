/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

import { ThemeNew } from './types';

/**
 * @summary Recursively resolve the inheritance hierarchy for a given theme.
 * Results are ordered starting from the base theme
 */
export function getThemeHierarchy(
    theme: ThemeNew,
    themes: ThemeNew[],
    deps?: ThemeNew[],
): ThemeNew[] {
    const dependencies = deps || [theme];
    if (!theme.parentID) return dependencies;

    const parent = themes.find(t => t.themeID === theme.parentID);
    if (!parent) {
        throw new Error(
            `Theme "${theme.themeID}" specified a parent of ` +
                `"${theme.parentID}", but that theme could not be found.`,
        );
    }

    dependencies.unshift(parent);
    return getThemeHierarchy(parent, themes, dependencies);
}
