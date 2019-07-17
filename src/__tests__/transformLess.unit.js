/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

const { preprocessMagicalMagentoImports } = require('../transformLess');

test('preprocessMagicalMagentoImports', () => {
    const less = `@import '_styles.less';
@import (reference) 'source/_extends.less';

//
//  Magento Import instructions
//  ---------------------------------------------

//@magento_import 'source/_module.less'; // Theme modules
//@magento_import 'source/_widgets.less'; // Theme widgets`;
    const tree = {
        'Magento_Foo/css/source/_module.less': {
            type: 'ThemeAsset',
            themeID: 'Magento/luma',
            moduleID: 'Magento_Foo',
            pathFromStoreRoot:
                '/app/design/frontend/Magento/luma/Magento_Foo/web/css/source/_module.less',
            finalPath: 'Magento_Foo/css/source/_module.less',
        },
        'Magento_Bar/css/source/_module.less': {
            type: 'ModuleAsset',
            moduleID: 'Magento_Bar',
            pathFromStoreRoot:
                '/app/code/Magento/Bar/view/frontend/web/css/source/_module.less',
            finalPath: 'Magento_Bar/css/source/_module.less',
        },
        'css/source/_module.less': {
            type: 'ThemeAsset',
            themeID: 'Magento/blank',
            pathFromStoreRoot:
                '/app/design/frontend/Magento/blank/web/css/source/_module.less',
            finalPath: 'css/source/_module.less',
        },
        'css/source/_widgets.less': {
            type: 'RootAsset',
            pathFromStoreRoot: '/lib/web/css/source/_widgets.less',
            finalPath: 'css/source/_widgets.less',
        },
    };

    expect(preprocessMagicalMagentoImports(less, tree)).toMatchInlineSnapshot(`
        "@import '_styles.less';
        @import (reference) 'source/_extends.less';

        //
        //  Magento Import instructions
        //  ---------------------------------------------

        @import '/app/design/frontend/Magento/luma/Magento_Foo/web/css/source/_module.less';
        @import '/app/code/Magento/Bar/view/frontend/web/css/source/_module.less';
        @import '/app/design/frontend/Magento/blank/web/css/source/_module.less'; // Theme modules
        @import '/lib/web/css/source/_widgets.less'; // Theme widgets"
    `);
});
