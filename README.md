# Publish Extensions to Open VSX

[![Gitpod Ready-to-Code](https://img.shields.io/badge/Gitpod-ready--to--code-blue?logo=gitpod)](https://gitpod.io/#https://github.com/open-vsx/publish-extensions)
[![GitHub Workflow Status](https://github.com/open-vsx/publish-extensions/workflows/Publish%20extensions%20to%20open-vsx.org/badge.svg)](https://github.com/open-vsx/publish-extensions/actions?query=workflow%3A%22Publish+extensions+to+open-vsx.org%22)

A CI for publishing open-source VS Code extensions to https://open-vsx.org

## How to Add an Extension?

⚠️ _If you maintain an extension, you probably want to [publish it yourself with the `ovsx` CLI](https://github.com/eclipse/openvsx/blob/master/cli/README.md) instead of adding it here._ ⚠️

To automatically publish an extension to Open VSX, simply add it to [`extensions.json`](./extensions.json).

You can also run `node add-extension [REPOSITORY]` to add it automatically.

[![Open in Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/#https://github.com/open-vsx/publish-extensions)

## Publishing Options

Here is the expected format of an [`extensions.json`](./extensions.json) entry:

```js
    {
      // Unique Open VSX extension ID in the form "<namespace>.<name>"
      "id": "redhat.vscode-yaml",
      // Repository URL to clone and publish from
      "repository": "https://github.com/redhat-developer/vscode-yaml"
    },
```

Here are all the supported values, including optional ones:

```js
    {
      // Unique Open VSX extension ID in the form "<namespace>.<name>"
      "id": "rebornix.ruby",
      // Repository URL to clone and publish from
      "repository": "https://github.com/rubyide/vscode-ruby",
      // (RECOMMENDED) The version that should be published; the script compares this version with the latest published version
      "version": "0.27.0",
      // (RECOMMENDED) The Git branch, tag, or commit to check out before publishing (defaults to the repository's default branch)
      "checkout": "v0.27.0",
      // (OPTIONAL) Location of the extension's package.json in the repository (defaults to the repository's root directory)
      "location": "packages/vscode-ruby-client",
      // (OPTIONAL) Extra commands to run just before publishing to Open VSX (i.e. after "yarn/npm install", but before "vscode:prepublish")
      "prepublish": "npm run build"
    },
```

In cases where it is not feasible to build the extension from source, a download URL can be given instead:

```js
    {
      // Unique Open VSX extension ID in the form "<namespace>.<name>"
      "id": "rebornix.ruby",
      // A full URL from which to download the extension package
      "download": "https://github.com/rubyide/vscode-ruby/releases/download/v0.25.0/ruby-0.25.0.vsix",
      // (RECOMMENDED) The version that should be published; the script compares this version with the latest published version
      "version": "0.25.0"
    },
```

## How are Extensions Published?

Every night at [03:03 UTC](https://github.com/open-vsx/publish-extensions/blob/e70fb554a5c265e53f44605dbd826270b860694b/.github/workflows/publish-extensions.yml#L3-L6), a [GitHub workflow](https://github.com/open-vsx/publish-extensions/blob/e70fb554a5c265e53f44605dbd826270b860694b/.github/workflows/publish-extensions.yml#L9-L21) goes through all entries in [`extensions.json`](./extensions.json), and checks if the specified `"version"` needs to be published to https://open-vsx.org or not.

The [publishing process](https://github.com/open-vsx/publish-extensions/blob/d2df425a84093023f4ee164592f2491c32166297/publish-extensions.js#L58-L87) can be summarized like this:

1. [`git clone "repository"`](https://github.com/open-vsx/publish-extensions/blob/d2df425a84093023f4ee164592f2491c32166297/publish-extensions.js#L61)
2. _([`git checkout "checkout"`](https://github.com/open-vsx/publish-extensions/blob/d2df425a84093023f4ee164592f2491c32166297/publish-extensions.js#L63) if a `"checkout"` value is specified)_
3. [`npm install`](https://github.com/open-vsx/publish-extensions/blob/d2df425a84093023f4ee164592f2491c32166297/publish-extensions.js#L68) (or `yarn install` if a `yarn.lock` file is detected in the repository)
4. _([`"prepublish"`](https://github.com/open-vsx/publish-extensions/blob/d2df425a84093023f4ee164592f2491c32166297/publish-extensions.js#L70))_
5. _([`ovsx create-namespace "publisher"`](https://github.com/open-vsx/publish-extensions/blob/d2df425a84093023f4ee164592f2491c32166297/publish-extensions.js#L75) if it doesn't already exist)_
6. [`ovsx publish`](https://github.com/open-vsx/publish-extensions/blob/d2df425a84093023f4ee164592f2491c32166297/publish-extensions.js#L86) (with `--yarn` if a `yarn.lock` file was detected earlier)

See all `ovsx` CLI options [here](https://github.com/eclipse/openvsx/blob/master/cli/README.md).
