/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

const { sequenceResolver } = require('../sequenceResolver');

test('Sorts dependencies by sequence', () => {
    const checkout = {
        name: 'Magento_Checkout',
        sequence: ['Magento_Product', 'Magento_Catalog'],
    };
    const product = {
        name: 'Magento_Product',
        sequence: [],
    };
    const catalog = {
        name: 'Magento_Catalog',
        sequence: [],
    };
    const result = sequenceResolver([checkout, product, catalog]);

    expect(result).toEqual([product, catalog, checkout]);
});
