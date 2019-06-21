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
} = require('../magentoFS');

const getFixturePath = name => join(__dirname, '__fixtures__', name);
const composerBlank = {
    name: 'blank',
    vendor: 'magento',
    themeID: 'Magento/blank',
    parentID: '',
    pathFromStoreRoot: '/vendor/magento/theme-frontend-blank',
};
const appDesignBlank = {
    name: 'blank',
    vendor: 'magento',
    themeID: 'Magento/blank',
    parentID: '',
    pathFromStoreRoot: '/app/design/frontend/Magento/blank',
};

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

test('parseThemePath handles path with module context in vendor', () => {
    const path =
        '/vendor/magento/theme-frontend-blank/Magento_Foo/web/css/source/_module.less';
    const result = parseThemePath(path, composerBlank);
    expect(result).toEqual({
        moduleID: 'Magento_Foo',
        pathFromStoreRoot: path,
        themeID: 'Magento/blank',
        type: 'ThemeAsset',
        finalPath: 'Magento_Foo/css/source/_module.less',
    });
});

test('parseThemePath handles path with module context in app/design', () => {
    const path =
        '/app/design/frontend/Magento/blank/Magento_Foo/web/css/source/_module.less';
    const result = parseThemePath(path, appDesignBlank);
    expect(result).toEqual({
        moduleID: 'Magento_Foo',
        pathFromStoreRoot: path,
        themeID: 'Magento/blank',
        type: 'ThemeAsset',
        finalPath: 'Magento_Foo/css/source/_module.less',
    });
});

test('parseThemePath handles path without module context in vendor', () => {
    const path = '/vendor/magento/theme-frontend-blank/web/foo.js';
    const result = parseThemePath(path, composerBlank);
    expect(result).toEqual({
        pathFromStoreRoot: path,
        themeID: 'Magento/blank',
        type: 'ThemeAsset',
        finalPath: 'foo.js',
    });
});

test('parseThemePath handles path without module context in app/design', () => {
    const path = '/app/design/frontend/Magento/blank/web/foo.js';
    const result = parseThemePath(path, appDesignBlank);
    expect(result).toEqual({
        pathFromStoreRoot: path,
        themeID: 'Magento/blank',
        type: 'ThemeAsset',
        finalPath: 'foo.js',
    });
});

test('parseModulePath handles file in vendor', () => {
    const path = '/vendor/magento/module-checkout/view/frontend/web/js/foo.js';
    const result = parseModulePath(path, {
        moduleID: 'Magento_Checkout',
        sequence: [],
        pathFromStoreRoot: '/vendor/magento/module-checkout',
    });
    expect(result).toEqual({
        type: 'ModuleAsset',
        moduleID: 'Magento_Checkout',
        pathFromStoreRoot: path,
        finalPath: 'js/foo.js',
    });
});

test('parseModulePath handles file in app/code', () => {
    const path = '/app/code/Magento/Checkout/view/frontend/web/js/foo.js';
    const result = parseModulePath(path, {
        moduleID: 'Magento_Checkout',
        sequence: [],
        pathFromStoreRoot: '/app/code/Magento/Checkout',
    });
    expect(result).toEqual({
        type: 'ModuleAsset',
        moduleID: 'Magento_Checkout',
        pathFromStoreRoot: path,
        finalPath: 'js/foo.js',
    });
});

test.todo('getComponents');
