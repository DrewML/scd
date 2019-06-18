# Unsupported Features

| Feature                        | Reasons                                                                                                                             |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| .less files in web/i18n        | Less is already one of the main bottlenecks. Less files per-locale require building less separately for each locale, in each theme. |
| any files in lib/web/18n       | Could be convinced to change this, but there are better ways to internationalize assets                                             |
| requirejs-config.js in lib/web | This works with the PHP implementation of static content deploy, but our docs explicitly say not to edit lib/web.                   |
