/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

const { join } = require('path');
const { getComponents, getEnabledModules } = require('../magentoFS');
const { generateRequireConfig } = require('../generateRequireConfig');

const getFixturePath = name => join(__dirname, '__fixtures__', name);

test('Merges require configs in the correct order', async () => {
    const path = getFixturePath('requireConfig');
    const components = await getComponents(path);

    const result = await generateRequireConfig(
        path,
        components.themes['Magento/luma'],
        components,
        await getEnabledModules(path),
    );

    expect(result).toMatchInlineSnapshot(`
        "(function() {
            /* Source: /app/code/Magento/Theme/view/frontend/requirejs-config.js */
            var config = {
            paths: {
                foo: 'bar',
            },
        };

            require.config(config);
        });

        (function() {
            /* Source: /app/code/Magento/Foo/view/frontend/requirejs-config.js */
            var config = {
            paths: {
                foo: 'bar',
            },
        };

            require.config(config);
        });

        (function() {
            /* Source: /app/code/Magento/Foo/view/base/requirejs-config.js */
            var config = {
            paths: {
                foo: 'bar',
            },
        };

            require.config(config);
        });

        (function() {
            /* Source: /app/design/frontend/Magento/blank/Magento_Theme/requirejs-config.js */
            var config = {
            paths: {
                foo: 'bar',
            },
        };

            require.config(config);
        });

        (function() {
            /* Source: /app/design/frontend/Magento/luma/Magento_Theme/requirejs-config.js */
            var config = {
            paths: {
                foo: 'bar',
            },
        };

            require.config(config);
        });

        (function() {
            /* Source: /app/design/frontend/Magento/blank/requirejs-config.js */
            var config = {
            paths: {
                foo: 'bar',
            },
        };

            require.config(config);
        });

        (function() {
            /* Source: /app/design/frontend/Magento/luma/requirejs-config.js */
            var config = {
            paths: {
                foo: 'bar',
            },
        };

            require.config(config);
        });

        "
    `);
});
