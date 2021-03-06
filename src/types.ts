/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

// TODO: Look into generating JSON schema
// from this type def
export type UserConfig = {
    storeRoot: string;
    themes: {
        name: string;
        locales: string[];
    }[];
};

export type ModuleConfig = {
    name: string;
    sequence: string[];
};

export type Components = {
    modules: Record<string, Module>;
    themes: Record<string, Theme>;
};

export type Theme = {
    name: string;
    themeID: string;
    vendor: string;
    area: 'frontend' | 'adminhtml';
    parentID?: string;
    pathFromStoreRoot: string;
};

export type Module = {
    moduleID: string;
    sequence: string[];
    pathFromStoreRoot: string;
};

export type ThemeAsset = {
    type: 'ThemeAsset';
    themeID: string;
    moduleID?: string;
    pathFromStoreRoot: string;
    finalPath: string;
};

export type ModuleAsset = {
    type: 'ModuleAsset';
    moduleID: string;
    pathFromStoreRoot: string;
    finalPath: string;
};

export type RootAsset = {
    type: 'RootAsset';
    pathFromStoreRoot: string;
    finalPath: string;
};

export type StaticAsset = ThemeAsset | ModuleAsset | RootAsset;

export type StaticAssetTree = Record<string, StaticAsset>;

export type CSSCompilationResult = {
    filesToRemove: string[];
    filesToAdd: GeneratedAsset[];
};

export type InMemoryAsset = {
    type: 'InMemoryAsset';
    source: string;
    finalPath: string;
};

export type TempFileAsset = {
    type: 'TempFileAsset';
    // absolute or relative?
    path: string;
    finalPath: string;
};

export type GeneratedAsset = InMemoryAsset | TempFileAsset;
