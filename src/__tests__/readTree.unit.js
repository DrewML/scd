/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

const { join } = require('path');
const { readTree } = require('../readTree');

const getFixturePath = name => join(__dirname, '__fixtures__', name);

test('readTree', async () => {
    const results = await readTree(getFixturePath('readTree'));
    expect(results).toMatchInlineSnapshot(`
        Array [
          "bar/bar.js",
          "bar/buzz/buzz.js",
          "file.html",
          "foo.js",
        ]
    `);
});
