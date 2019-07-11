# Unsupported Features

| Feature                                                                    | Reasons                                                                                                                             |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| .less files in web/i18n                                                    | Less is already one of the main bottlenecks. Less files per-locale require building less separately for each locale, in each theme. |
| any files in lib/web/18n                                                   | Could be convinced to change this, but there are better ways to internationalize assets                                             |
| requirejs-config.js in any module folder (in a theme) except Magento_Theme | Can't find any themes in the wild that actually rely on this, so saving the disk hits                                               |
