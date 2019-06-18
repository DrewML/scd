/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

export type ModuleConfig = {
    name: string;
    sequence: string[];
};

export type Components = {
    modules: Record<string, ModuleNew>;
    themes: ThemeNew[];
};

export type Theme = {
    name: string;
    vendor: string;
    area: 'frontend' | 'adminhtml';
};

export type ThemeNew = {
    name: string;
    themeID: string;
    vendor: string;
    area: 'frontend' | 'adminhtml';
    parentID?: string;
    pathFromStoreRoot: string;
};

export type ModuleNew = {
    // ex: Magento_Shipping
    moduleID: string;
    // ex: Magento_Checkout, Magento_Discounts
    sequence: string[];
    pathFromStoreRoot: string;
};

export type Module = {
    name: string;
    vendor: string;
};

export type ThemeAsset = {
    type: 'ThemeAsset';
    themeID: string;
    moduleID?: string;
    pathFromStoreRoot: string;
};

export type ModuleAsset = {
    type: 'ModuleAsset';
    moduleID: string;
    pathFromStoreRoot: string;
};

export type RootAsset = {
    type: 'RootAsset';
    pathFromStoreRoot: string;
};

export type StaticAsset = ThemeAsset | ModuleAsset | RootAsset;

export type StaticAssetTree = Record<string, StaticAsset>;
