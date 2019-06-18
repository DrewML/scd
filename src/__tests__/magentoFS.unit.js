/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

// WARNING: Assertions on list of files must not assert on
// file/directory order, because it's not reliable cross-platform

const { join } = require('path');
const {
    getEnabledModules,
    parseThemePath,
    parseModulePath,
    getComponents,
} = require('../magentoFS');

const getFixturePath = name => join(__dirname, '__fixtures__', name);

test.only('getComponents', async () => {
    const result = await getComponents('/Users/andrewlevine/sites/demo');
    console.log(JSON.stringify(result, null, 2));
});

test('getEnabledModules only returns enabled modules', async () => {
    const result = await getEnabledModules(getFixturePath('modulesConfig'));
    expect(result).toContain('Magento_Store');
    expect(result).toContain('Magento_AdvancedPricingImportExport');
    expect(result).toContain('Magento_Directory');
    expect(result).toContain('Magento_Amqp');
    expect(result).toContain('Magento_Config');
    expect(result).toContain('Magento_Backend');
    expect(result).toContain('Magento_Authorization');
    expect(result).not.toContain('Magento_Theme');
});

test('parseThemePath', () => {
    expect(
        parseThemePath(
            '/app/design/frontend/Magento/luma/Magento_GiftWrapping/web/css/source/_module.less',
        ),
    ).toEqual({
        type: 'ThemeAsset',
        theme: {
            name: 'luma',
            vendor: 'Magento',
            area: 'frontend',
        },
        module: {
            name: 'GiftWrapping',
            vendor: 'Magento',
        },
        pathFromStoreRoot:
            '/app/design/frontend/Magento/luma/Magento_GiftWrapping/web/css/source/_module.less',
    });
});

test('parseModulePath', () => {
    expect(
        parseModulePath(
            '/app/code/Magento/Theme/view/frontend/web/templates/breadcrumbs.html',
            'Magento_Theme',
        ),
    ).toEqual({
        type: 'ModuleAsset',
        module: { name: 'Theme', vendor: 'Magento' },
        pathFromStoreRoot:
            '/app/code/Magento/Theme/view/frontend/web/templates/breadcrumbs.html',
    });
});
