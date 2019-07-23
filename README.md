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

## How to use

This project is not quite ready yet, and many features from Magento core are not supported just yet. If you want to live on the bleeding edge, you can follow the developer instructions below.

## How to work on `scd`

1. Ensure you have a version of `node.js` locally that is >= `v10.12.0`
2. Clone the repository
3. In the root, run `npm install`
4. Run `npm test` to verify you've set everything up properly. All tests are expected to pass

## How to run against a store locally

1. Run [`npm link`](https://docs.npmjs.com/cli/link) in the root of this repository _once_. This will add the global `scd` command to your `$PATH`

You can now run `scd` in the root directory of any Magento 2 store locally.

## What works for far?

Only one scenario has been tested and developed against so far. This is:

-   Stock store on 2.3-develop
-   Using Luma
-   Only targeting `en_US`

Things that have not been tested yet:

-   Translations (they're not even implemented, so they surely don't work)
-   `adminhtml` theme(s) (they might work, but I haven't tested)
-   Deploying multiple themes at once. It might work (untested), but they're currently processed serially

## Should I use this for Production?

You're probably not going to listen to me, but I wouldn't just yet.

## Unsupported Features

See [`UNSUPPORTED.md`](UNSUPPORTED.md)

## Design Goals

-   Favor speed over memory consumption _always_. Memory is cheap, time is not
-   (Except in rare cases) data structures passed between module boundaries should be limited to those that can be easily serialized to JSON. This keeps it possible to move modules to a worker or use caches for only certain tasks later.
-   Always favor optimizing code over caching
    -   Only add caching in places where slow things cannot otherwise be sped up
    -   Caches are always a bug farm in build tools
-   Thoroughly loggable/traceable
-   As much of the code base should be stateless as possible. Keep state confined to well-defined areas
-   Keep root path handling separate from relative path handling
    -   Any persistent caching should work even when store is moved to another dir on disk or copied to another fs
-   Compiled/released version should be compatible with Windows, but only \*nix compat is fine for building the project and running tests
