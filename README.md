<p align="center">
  <h1 align="center">scd</h1>
  <h2 align="center">
  Fast, drop-in replacement for <a href="https://devdocs.magento.com/guides/v2.3/config-guide/cli/config-cli-subcommands-static-view.html" target="_blank">Magento's Static Content Deploy</a>
  </h2>
  <p align="center">
  <a href="https://circleci.com/gh/DrewML/scd"><img src="https://circleci.com/gh/DrewML/scd.svg?style=svg"></a>
  </p>
</p>

## Why?

For background on the motivations for the `scd` project, please see [the original proposal](https://github.com/magento/architecture/pull/168).

## How to work on `scd`

1. Ensure you have a version of `node.js` locally that is >= `v10.12.0`
2. Clone the repository
3. In the root, run `npm install`
4. Run `npm test` to verify you've set everything up properly. All tests are expected to pass

## How to run against a store locally

1. Run [`npm link`](https://docs.npmjs.com/cli/link) in the root of this repository _once_. This will add the global `scd` command to your `$PATH`

You can now run `scd` in the root directory of any Magento 2 store locally.

## What works for far?

-   ✅ Parallel Less Compilation
-   ✅ requirejs-config.js merging
-   ✅ File fallback

## In-Progress or non-started

-   Merging/transforming i18n files to JSON
-   Parallel JavaScript minification (or any minification, really)

## Should I use this for Production?

**NOPE**
