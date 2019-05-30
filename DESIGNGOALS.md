# Design Goals

-   Favor speed over memory consumption _always_. Memory is cheap, time is not
-   Persistently cache as many things as possible between builds
-   Granular error handling over general error handling
-   Thoroughly loggable/traceable
-   Writing assets to disk must be an atomic operation
-   As many modules should be stateless as possible. Keep state confined to well-defined areas (caches are the big exception)
-   Keep root path handling separate from relative path handling
    -   Persistent cache should work even when store is moved to another dir on disk or copied to another fs
-   Compiled/released version should be compatible with Windows. Dev-time tooling can be \*nix-only (Windows devs can use WSL)
    -   Never do direct string manipulation of file paths
