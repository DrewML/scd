# Design Goals

-   Favor speed over memory consumption _always_. Memory is cheap, time is not
-   Persistently cache as many things as possible between builds
-   Granular error handling over general error handling
-   Thoroughly loggable/traceable
-   Writing assets to disk must be an atomic operation
