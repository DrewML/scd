/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

// WARNING: Assertions on list of files must not assert on
// file/directory order, because it's not reliable cross-platform

const { join } = require('path');
const {
    getEnabledModules,
    getModulesOnDisk,
    getThemes,
    getThemeParent,
} = require('../magentoFS');

const getFixturePath = name => join(__dirname, '__fixtures__', name);

test('getEnabledModules only returns enabled modules', async () => {
    const result = await getEnabledModules(getFixturePath('modulesConfig'));
    expect(result).toEqual(
        new Set([
            'Magento_Store',
            'Magento_AdvancedPricingImportExport',
            'Magento_Directory',
            'Magento_Amqp',
            'Magento_Config',
            'Magento_Backend',
            'Magento_Authorization',
            // 'Magento_Theme', disabled module
        ]),
    );
});

test('getModulesOnDisk finds all modules, both enabled and disabled', async () => {
    const result = await getModulesOnDisk(
        getFixturePath('firstAndThirdPartyModules'),
    );
    expect(result).toContain('Foobar_Module1');
    expect(result).toContain('Foobar_Module2');
    expect(result).toContain('Magento_Module4');
    expect(result).toContain('Magento_Module4');
});

test('getModulesOnDisk does not error when app/vendor is not on disk', async () => {
    const result = await getModulesOnDisk(getFixturePath('noVendorsDir'));
    expect(result).toContain('Foobar_Module1');
    expect(result).toContain('Foobar_Module2');
});

test('getThemes finds all themes', async () => {
    const result = await getThemes(getFixturePath('stockThemes'));
    expect(result).toContainEqual({
        name: 'blank',
        vendor: 'Magento',
        area: 'frontend',
    });
    expect(result).toContainEqual({
        name: 'luma',
        vendor: 'Magento',
        area: 'frontend',
    });
    expect(result).toContainEqual({
        name: 'backend',
        vendor: 'Magento',
        area: 'adminhtml',
    });
});

test('getThemeParent finds parent', async () => {
    const result = await getThemeParent(getFixturePath('stockThemes'), {
        area: 'frontend',
        vendor: 'Magento',
        name: 'luma',
    });
    expect(result).toEqual({
        name: 'blank',
        vendor: 'Magento',
        area: 'frontend',
    });
});
