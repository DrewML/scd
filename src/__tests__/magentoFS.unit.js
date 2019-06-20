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
    finalPathFromStaticAsset,
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
    });
});

test('parseThemePath handles path without module context in vendor', () => {
    const path = '/vendor/magento/theme-frontend-blank/web/foo.js';
    const result = parseThemePath(path, composerBlank);
    expect(result).toEqual({
        pathFromStoreRoot: path,
        themeID: 'Magento/blank',
        type: 'ThemeAsset',
    });
});

test('parseThemePath handles path without module context in app/design', () => {
    const path = '/app/design/frontend/Magento/blank/web/foo.js';
    const result = parseThemePath(path, appDesignBlank);
    expect(result).toEqual({
        pathFromStoreRoot: path,
        themeID: 'Magento/blank',
        type: 'ThemeAsset',
    });
});

test('parseModulePath', () => {
    const path = '/vendor/magento/module-checkout/view/frontend/web/js/foo.js';
    const result = parseModulePath(path, 'Magento_Checkout');
    expect(result).toEqual({
        type: 'ModuleAsset',
        moduleID: 'Magento_Checkout',
        pathFromStoreRoot: path,
    });
});

test('finalPathFromStaticAsset handles root asset', () => {
    const asset = {
        type: 'RootAsset',
        pathFromStoreRoot: '/lib/web/foo.js',
    };
    const components = {
        themes: [],
        modules: {},
    };
    const result = finalPathFromStaticAsset(asset, components);
    expect(result).toEqual('foo.js');
});

test('finalPathFromStaticAsset handles theme asset without module context from composer', () => {
    const asset = {
        type: 'ThemeAsset',
        themeID: 'Magento/blank',
        pathFromStoreRoot:
            '/vendor/magento/theme-frontend-blank/web/images/foo.svg',
    };
    const components = {
        themes: [composerBlank],
        modules: {},
    };
    const result = finalPathFromStaticAsset(asset, components);
    expect(result).toEqual('images/foo.svg');
});

test('finalPathFromStaticAsset handles theme asset with module context from composer', () => {
    const asset = {
        type: 'ThemeAsset',
        themeID: 'Magento/blank',
        moduleID: 'Magento_Email',
        pathFromStoreRoot:
            '/vendor/magento/theme-frontend-blank/Magento_Email/web/foo.png',
    };
    const components = {
        themes: [composerBlank],
        modules: {},
    };
    const result = finalPathFromStaticAsset(asset, components);
    expect(result).toEqual('Magento_Email/foo.png');
});

test('finalPathFromStaticAsset handles theme asset without module context from app/design', () => {
    const asset = {
        type: 'ThemeAsset',
        themeID: 'Magento/blank',
        pathFromStoreRoot:
            '/app/design/frontend/Magento/blank/web/images/foo.png',
    };
    const components = {
        themes: [appDesignBlank],
        modules: {},
    };
    const result = finalPathFromStaticAsset(asset, components);
    expect(result).toEqual('images/foo.png');
});

test('finalPathFromStaticAsset handles theme asset with module context from app/design', () => {
    const asset = {
        type: 'ThemeAsset',
        themeID: 'Magento/blank',
        moduleID: 'Magento_Foo',
        pathFromStoreRoot:
            '/app/design/frontend/Magento/blank/Magento_Foo/web/images/foo.png',
    };
    const components = {
        themes: [appDesignBlank],
        modules: {},
    };
    const result = finalPathFromStaticAsset(asset, components);
    expect(result).toEqual('Magento_Foo/images/foo.png');
});

test('finalPathFromStaticAsset handles module asset from app/code', () => {
    const asset = {
        type: 'ModuleAsset',
        moduleID: 'Magento_Foo',
        pathFromStoreRoot: '/app/code/Magento/Foo/view/frontend/web/js/foo.js',
    };
    const components = {
        themes: [],
        modules: {
            Magento_Foo: {
                moduleID: 'Magento_Foo',
                sequence: [],
                pathFromStoreRoot: '/app/code/Magento/Foo',
            },
        },
    };
    const result = finalPathFromStaticAsset(asset, components);
    expect(result).toEqual('Magento_Foo/js/foo.js');
});

test('finalPathFromStaticAsset handles module asset from composer', () => {
    const asset = {
        type: 'ModuleAsset',
        moduleID: 'Magento_Foo',
        pathFromStoreRoot:
            '/vendor/magento/module-foo/view/frontend/web/js/foo.js',
    };
    const components = {
        themes: [],
        modules: {
            Magento_Foo: {
                moduleID: 'Magento_Foo',
                sequence: [],
                pathFromStoreRoot: '/vendor/magento/module-foo',
            },
        },
    };
    const result = finalPathFromStaticAsset(asset, components);
    expect(result).toEqual('Magento_Foo/js/foo.js');
});

test.todo('getComponents');
