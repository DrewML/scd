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
    getThemeHierarchy,
    parseThemePath,
    themeFileToThemeless,
    getModuleViewDir,
    parseModulePath,
} = require('../magentoFS');

const getFixturePath = name => join(__dirname, '__fixtures__', name);

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

test('getModulesOnDisk finds all modules, both enabled and disabled', async () => {
    const result = await getModulesOnDisk(
        getFixturePath('firstAndThirdPartyModules'),
    );
    expect(result).toContainEqual({
        name: 'Foobar_Module1',
        sequence: [
            'Magento_Catalog',
            'Magento_Checkout',
            'Magento_Customer',
            'Magento_Directory',
            'Magento_User',
        ],
    });
    expect(result).toContainEqual({
        name: 'Foobar_Module2',
        sequence: ['Magento_Catalog'],
    });
    expect(result).toContainEqual({
        name: 'Magento_Module3',
        sequence: [],
    });
    expect(result).toContainEqual({
        name: 'Magento_Module4',
        sequence: ['Magento_Directory', 'Magento_User'],
    });
});

test.skip('getModulesOnDisk does not error when app/vendor is not on disk', async () => {
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

test('getThemeHierarchy returns correct hierarchy for default themes', async () => {
    const [parent, child] = await getThemeHierarchy(
        getFixturePath('stockThemes'),
        {
            area: 'frontend',
            vendor: 'Magento',
            name: 'luma',
        },
    );
    expect(parent).toEqual({
        area: 'frontend',
        vendor: 'Magento',
        name: 'blank',
    });
    expect(child).toEqual({
        area: 'frontend',
        vendor: 'Magento',
        name: 'luma',
    });
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
        moduleContext: 'Magento_GiftWrapping',
        path: 'web/css/source/_module.less',
    });
});

test('themeFileToThemeless with module context', () => {
    expect(
        themeFileToThemeless({
            theme: {
                name: 'luma',
                vendor: 'Magento',
                area: 'frontend',
            },
            moduleContext: 'Magento_GiftWrapping',
            path: 'web/css/source/_module.less',
        }),
    ).toBe('Magento_GiftWrapping/web/css/source/_module.less');
});

test('themeFileToThemeless without module context', () => {
    expect(
        themeFileToThemeless({
            theme: {
                name: 'luma',
                vendor: 'Magento',
                area: 'frontend',
            },
            path: 'web/css/source/_module.less',
        }),
    ).toBe('web/css/source/_module.less');
});

test('getModuleViewDir finds module in code dir', async () => {
    const root = getFixturePath('firstAndThirdPartyModules');
    const path = await getModuleViewDir(root, 'Foobar_Module1', 'frontend');
    expect(path).toBe('app/code/Foobar/Module1/view/frontend');
});

test('getModuleViewDir finds module in vendor dir', async () => {
    const root = getFixturePath('firstAndThirdPartyModules');
    const path = await getModuleViewDir(root, 'Magento_Module3', 'frontend');
    expect(path).toBe('app/vendor/Magento/Module3/view/frontend');
});

test('parseModulePath', () => {
    expect(
        parseModulePath(
            'app/code/Magento/Theme/view/frontend/web/templates/breadcrumbs.html',
            'Magento_Theme',
        ),
    ).toEqual({
        type: 'ModuleAsset',
        moduleContext: 'Magento_Theme',
        path: '/view/frontend/web/templates/breadcrumbs.html',
    });
});
