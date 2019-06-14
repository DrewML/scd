/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

export type ModuleConfig = {
    name: string;
    sequence: string[];
};

export type Theme = {
    name: string;
    vendor: string;
    area: 'frontend' | 'adminhtml';
};

export type Module = {
    name: string;
    vendor: string;
};

export type ThemeAsset = {
    type: 'ThemeAsset';
    theme: Theme;
    module?: Module;
    path: string;
};

export type ModuleAsset = {
    type: 'ModuleAsset';
    module: Module;
    path: string;
};

export type RootAsset = {
    type: 'RootAsset';
    path: string;
};

export type StaticAsset = ThemeAsset | ModuleAsset | RootAsset;

export type StaticAssetTree = Record<string, StaticAsset>;
