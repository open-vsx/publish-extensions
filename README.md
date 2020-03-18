# Publish Extensions to Open VSX

[![Gitpod Ready-to-Code](https://img.shields.io/badge/Gitpod-ready--to--code-blue?logo=gitpod)](https://gitpod.io/#https://github.com/open-vsx/publish-extensions)
[![GitHub Workflow Status](https://github.com/open-vsx/publish-extensions/workflows/Publish%20extensions%20to%20open-vsx.org/badge.svg)](https://github.com/open-vsx/publish-extensions/actions?query=workflow%3A%22Publish+extensions+to+open-vsx.org%22)

A CI for publishing open-source VS Code extensions to https://open-vsx.org

## How to add an extension?

To automatically publish an extension to Open VSX, simply add it to [`extensions.json`](./extensions.json).

You can also run `node add-extension [REPOSITORY]` to add it automatically.

[![Open in Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/#https://github.com/open-vsx/publish-extensions)

## Publishing options

Here is the expected format of an `extensions.json` entry:

```js
    {
      "id": "redhat.vscode-yaml", // Unique Open VSX extension ID in the form "<namespace>.<name>"
      "repository": "https://github.com/redhat-developer/vscode-yaml" // Repository URL to clone and publish from
    },
```

Here are all the supported values, including optional ones:

```js
    {
      "id": "ms-vscode.cpptools", // Unique Open VSX extension ID in the form "<namespace>.<name>"
      "version": "0.26.3", // [OPTIONAL] The version to publish to Open VSX (defaults your package.json version)
      "repository": "https://github.com/microsoft/vscode-cpptools", // Repository URL to clone and publish from
      "checkout": "0.26.3", // [OPTIONAL] The Git branch, tag, or commit to check out before publishing (defaults to Git's default branch)
      "location": "Extension" // [OPTIONAL] Location of your extension's package.json in the repository (defaults to ".")
    },
```
