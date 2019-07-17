/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

import less from 'less';
import { promises as fs } from 'fs';
import { StaticAssetTree } from './types';
import { join, extname, sep, relative, parse } from 'path';

type LessResult = {
    css?: string;
    sourceMap?: string;
    error?: Less.RenderError;
};
export async function compileLess(
    root: string,
    tree: StaticAssetTree,
    entry: string,
): Promise<LessResult> {
    const asset = tree[entry];
    const assetPath = join(root, asset.pathFromStoreRoot);
    const src = await fs.readFile(assetPath, 'utf8');
    // Consider doing the pre-processing in a Less pre-processing
    // plugin, which _should_ give us source mapping
    const preprocessed = preprocessMagicalMagentoImports(
        asset.finalPath,
        src,
        tree,
    );

    try {
        // TODO: Configurable source-maps
        const result = await less.render(preprocessed, {
            plugins: [new LessFileManagerPlugin(root, tree)],
            filename: asset.finalPath,
        });

        return {
            css: result.css,
            sourceMap: result.map,
        };
    } catch (error) {
        return { error };
    }
}

/**
 * @summary Explode Magento's @magento_import rule
 *          Note that Magento core does not respect
 *          sequence order here (afaict), so we won't either
 * @see https://devdocs.magento.com/guides/v2.3/frontend-dev-guide/css-topics/css-preprocess.html#magento_import_example
 */
function preprocessMagicalMagentoImports(
    assetPath: string,
    css: string,
    tree: StaticAssetTree,
) {
    // RegExp roughly taken from https://github.com/magento/magento2/blob/0eb8677b0b4e35606032e856cc1ef7c80e68829f/lib/internal/Magento/Framework/Css/PreProcessor/Instruction/MagentoImport.php#L27,
    // but fixed some bugs in it. Sorry to whoever touches this one next, but
    // I wrote unit tests for you :)
    const reImport = /\/\/\s*@magento_import\s+(?:\((?<opts>[a-z, ]+)\))?\s?['"](?<importPattern>.+)['"]\s*;/g;
    return css.replace(reImport, (...args) => {
        const [groups] = args.slice(-1);
        return findMatchesInTree(groups.importPattern, tree)
            .map(asset => {
                // @magento_import paths, when exploded into @import's
                // must use paths relative to the less file they were found in
                const importPath = relative(
                    parse(assetPath).dir,
                    asset.finalPath,
                );
                // Preserve less import options
                // http://lesscss.org/features/#import-atrules-feature-import-options
                return groups.opts
                    ? `@import (${groups.opts}) '${importPath}';`
                    : `@import '${importPath}';`;
            })
            .join('\n');
    });
}

/**
 * @summary Finds all assets in the tree that match
 *          the provided @magento_import path
 */
function findMatchesInTree(path: string, tree: StaticAssetTree) {
    return Object.values(tree).filter(asset => {
        // Get path relative to `css` dir, excluding module context
        const finalPath = asset.hasOwnProperty('moduleID')
            ? // format: Magento_Foo/css/source/_partial.less
              asset.finalPath
                  .split(sep)
                  .slice(1)
                  .join(sep)
            : // format: css/source/_partial.less
              asset.finalPath;
        const relPath = relative('css', finalPath);
        const pathWithExt = extname(path) ? path : `${path}.less`;
        return pathWithExt.endsWith(relPath);
    });
}

/**
 * @summary Implement the Less compiler's
 *          file manager interface to prevent
 *          the default fs scanning behavior, since
 *          we know the paths in the final tree. This
 *          allows us to avoid using a `view_preprocessed`
 *          temp dir like Magento core
 */
// @ts-ignore Less typings are missing for FileManager
class LessFileManager extends (less.FileManager as any) {
    tree: StaticAssetTree;
    root: string;
    constructor(tree: StaticAssetTree, root: string) {
        super();
        this.tree = tree;
        this.root = root;
    }

    /**
     *
     * @summary Overwrite `loadFile` in base class
     *          to re-map lookups to our in-memory tree
     */
    async loadFile(filename: string, currentDirectory: string) {
        const treePath = join(currentDirectory, filename);
        const asset = this.tree[treePath];
        const contents = await fs.readFile(
            join(this.root, asset.pathFromStoreRoot),
            'utf8',
        );

        return { contents, filename: treePath };
    }
}
class LessFileManagerPlugin {
    root: string;
    tree: StaticAssetTree;
    constructor(root: string, tree: StaticAssetTree) {
        this.root = root;
        this.tree = tree;
    }

    install(less: LessStatic, pluginManager: Less.PluginManager) {
        // @ts-ignore missing types in less def
        pluginManager.addFileManager(new LessFileManager(this.tree, this.root));
    }
}
