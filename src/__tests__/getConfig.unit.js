/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

const { join } = require('path');
const { getConfig } = require('../getConfig');

const getFixturePath = name => join(__dirname, '__fixtures__', name);

test('getConfig finds config in provided dir', async () => {
    const config = await getConfig(getFixturePath('getConfigRoot'));
    expect(config).toEqual({
        storeRoot: '/Users/andrewlevine/sites/demo',
        themes: [
            {
                locales: ['en_US'],
                name: 'luma',
            },
        ],
    });
});

test('getConfig finds config one dir up', async () => {
    const config = await getConfig(getFixturePath('getConfigRoot/nestedDir'));
    expect(config).toEqual({
        storeRoot: '/Users/andrewlevine/sites/demo',
        themes: [
            {
                locales: ['en_US'],
                name: 'luma',
            },
        ],
    });
});

test('getConfig does not throw when config cannot be found', async () => {
    const config = await getConfig(getFixturePath('dirDoesNotExist'));
    expect(config).toBe(undefined);
});
