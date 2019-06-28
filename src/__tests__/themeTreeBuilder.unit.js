/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

const { join } = require('path');
const { getComponents } = require('../magentoFS');
const { themeTreeBuilder } = require('../themeTreeBuilder');

const getFixturePath = name => join(__dirname, '__fixtures__', name);

test('themeTreeBuilder works with assets in app dir', async () => {
    const fixture = getFixturePath('themeTreeBuilder-app-dir');
    const components = await getComponents(fixture);
    const tree = await themeTreeBuilder({
        root: fixture,
        theme: components.themes.find(t => t.name === 'luma'),
        components,
        enabledModules: ['Magento_Foo'],
    });
    expect(tree).toMatchInlineSnapshot(`
        Object {
          "Magento_Foo/js/foo-file1.js": Object {
            "finalPath": "Magento_Foo/js/foo-file1.js",
            "moduleID": "Magento_Foo",
            "pathFromStoreRoot": "/app/design/frontend/Magento/luma/Magento_Foo/web/js/foo-file1.js",
            "themeID": "Magento/luma",
            "type": "ThemeAsset",
          },
          "Magento_Foo/js/foo-file2.js": Object {
            "finalPath": "Magento_Foo/js/foo-file2.js",
            "moduleID": "Magento_Foo",
            "pathFromStoreRoot": "/app/code/Magento/Foo/view/frontend/web/js/foo-file2.js",
            "type": "ModuleAsset",
          },
          "Magento_Foo/js/foo-file3.js": Object {
            "finalPath": "Magento_Foo/js/foo-file3.js",
            "moduleID": "Magento_Foo",
            "pathFromStoreRoot": "/app/code/Magento/Foo/view/base/web/js/foo-file3.js",
            "type": "ModuleAsset",
          },
          "theme-ctx-file1.js": Object {
            "finalPath": "theme-ctx-file1.js",
            "pathFromStoreRoot": "/app/design/frontend/Magento/luma/web/theme-ctx-file1.js",
            "themeID": "Magento/luma",
            "type": "ThemeAsset",
          },
          "theme-ctx-file2.js": Object {
            "finalPath": "theme-ctx-file2.js",
            "pathFromStoreRoot": "/app/design/frontend/Magento/blank/web/theme-ctx-file2.js",
            "themeID": "Magento/blank",
            "type": "ThemeAsset",
          },
          "theme-ctx-file3.js": Object {
            "finalPath": "theme-ctx-file3.js",
            "pathFromStoreRoot": "/app/design/frontend/Magento/blank/web/theme-ctx-file3.js",
            "themeID": "Magento/blank",
            "type": "ThemeAsset",
          },
          "theme-ctx-file4.js": Object {
            "finalPath": "theme-ctx-file4.js",
            "pathFromStoreRoot": "/lib/web/theme-ctx-file4.js",
            "type": "RootAsset",
          },
        }
    `);
});
