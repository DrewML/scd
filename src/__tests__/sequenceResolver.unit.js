/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

const { sequenceResolver } = require('../sequenceResolver');

test('Sorts dependencies by sequence', () => {
    const checkout = {
        moduleID: 'Magento_Checkout',
        sequence: ['Magento_Product', 'Magento_Catalog'],
        pathFromStoreRoot: '',
    };
    const product = {
        moduleID: 'Magento_Product',
        sequence: [],
        pathFromStoreRoot: '',
    };
    const catalog = {
        moduleID: 'Magento_Catalog',
        sequence: [],
        pathFromStoreRoot: '',
    };
    const result = sequenceResolver([checkout, product, catalog]);

    expect(result).toEqual([product, catalog, checkout]);
});
