/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

const { getThemeHierarchy } = require('../getThemeHierarchy');

test('getThemeHierarchy resolves single parent', () => {
    const themes = [
        {
            name: 'blank',
            vendor: 'magento',
            themeID: 'Magento/blank',
            area: 'frontend',
            parentID: '',
            pathFromStoreRoot: '/vendor/magento/theme-frontend-blank',
        },
        {
            name: 'luma',
            vendor: 'magento',
            themeID: 'Magento/luma',
            area: 'frontend',
            parentID: 'Magento/blank',
            pathFromStoreRoot: '/vendor/magento/theme-frontend-luma',
        },
    ];
    const [parent, child] = getThemeHierarchy(themes[1], themes);
    expect(parent.themeID).toBe('Magento/blank');
    expect(child.themeID).toBe('Magento/luma');
});

test('getThemeHierarchy resolves multiple parents', () => {
    const themes = [
        {
            name: 'blank',
            vendor: 'magento',
            themeID: 'Magento/blank',
            area: 'frontend',
            parentID: 'Stranger/empty',
            pathFromStoreRoot: '/vendor/magento/theme-frontend-blank',
        },
        {
            name: 'luma',
            vendor: 'magento',
            themeID: 'Magento/luma',
            area: 'frontend',
            parentID: 'Magento/blank',
            pathFromStoreRoot: '/vendor/magento/theme-frontend-luma',
        },
        {
            name: 'empty',
            vendor: 'stranger',
            themeID: 'Stranger/empty',
            area: 'frontend',
            parentID: '',
            pathFromStoreRoot: '/vendor/magento/theme-frontend-luma',
        },
    ];
    const results = getThemeHierarchy(themes[1], themes);
    expect(results[0].themeID).toBe('Stranger/empty');
    expect(results[1].themeID).toBe('Magento/blank');
    expect(results[2].themeID).toBe('Magento/luma');
});

test('Meaningful error when specified parent does not exist', () => {
    const themes = [
        {
            name: 'luma',
            vendor: 'magento',
            themeID: 'Magento/luma',
            area: 'frontend',
            parentID: 'Magento/blank',
            pathFromStoreRoot: '/vendor/magento/theme-frontend-luma',
        },
    ];
    const fn = () => getThemeHierarchy(themes[0], themes);
    expect(fn).toThrow(
        'Theme "Magento/luma" specified a parent of "Magento/blank", but that theme could not be found.',
    );
});
