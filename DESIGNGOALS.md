# Design Goals

-   Favor speed over memory consumption _always_. Memory is cheap, time is not
-   Always favor optimizing code over caching
    -   Only add caching in places where slow things cannot otherwise be sped up
    -   Caches are always a bug farm in build tools
-   Granular error handling over general, top-level error handling
-   Thoroughly loggable/traceable
-   Writing assets to disk must be an atomic operation
-   As much of the code base should be stateless as possible. Keep state confined to well-defined areas
-   Keep root path handling separate from relative path handling
    -   Any persistent caching should work even when store is moved to another dir on disk or copied to another fs
-   Compiled/released version should be compatible with Windows. Dev-time tooling can be \*nix-only (Windows devs can use WSL)
    -   Never do direct string manipulation of file paths
