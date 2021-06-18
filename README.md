# Publish Extensions to Open VSX

[![Gitpod Ready-to-Code](https://img.shields.io/badge/Gitpod-ready--to--code-908a85?logo=gitpod)](https://gitpod.io/#https://github.com/open-vsx/publish-extensions)
[![GitHub Workflow Status](https://github.com/open-vsx/publish-extensions/workflows/Publish%20extensions%20to%20open-vsx.org/badge.svg)](https://github.com/open-vsx/publish-extensions/actions?query=workflow%3A%22Publish+extensions+to+open-vsx.org%22)

A CI script for publishing open-source VS Code extensions to [open-vsx.org](https://open-vsx.org).

## When to Add an Extension?

One goal of Open VSX is to have extension maintainers publish their extensions [according to the documentation](https://github.com/eclipse/openvsx/wiki/Publishing-Extensions). However, you may be missing specific extensions that have not been published by their maintainers: either they are not willing to do it, or they haven't found time to do it, or simply they haven't heard about Open VSX yet. Though the preferred solution for such a situation is to convince the maintainers to start publishing themselves, you can add the extensions here to have them published by our CI workflow.

⚠️ We accept only extensions with [OSI-approved open source licenses](https://opensource.org/licenses) here. If you want to have an extension with a proprietary or non-approved license, please ask its maintainers to publish it.

## How to Add an Extension?

To automatically publish an extension to Open VSX, simply add it to [`extensions.json`](./extensions.json) with the [options described below](#publishing-options). You can run `node add-extension [REPOSITORY] --checkout` to create an entry automatically.

⚠️ Some extensions require additional build steps, and failing to execute them may lead to a broken extension published to Open VSX. Please check the extension's `scripts` section in the package.json file to find such steps; usually they are named `build` or similar. In case the build steps are included in the [vscode:prepublish](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#prepublish-step) script, they are executed automatically, so it's not necessary to mention them explicitly. Otherwise, please include them in the `prepublish` value, e.g. `"prepublish": "npm run build"`.

Click the button below to start a [Gitpod](https://gitpod.io) workspace where you can run the scripts contained in this repository:

[![Open in Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/#https://github.com/open-vsx/publish-extensions)

## Publishing Options

The best way to add an extension here is to open this repository in Gitpod (using the blue button above) and to run this helper script:

```bash
node add-extension $REPOSITORY_URL --checkout
```

Notes:
- Simply replace `$REPOSITORY_URL` with the extension's actual repository URL
- This will update `extensions.json` automatically, which you can commit to send a Pull Request
- Adding `--checkout` (without an explicit value) will auto-detect the latest available Git release tag or branch

If you're curious, here are the expected formats of an [`extensions.json`](./extensions.json) entry:

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

Or, in cases where the extension maintainers don't provide a `.vsix` release to download, you can build the extension from source instead:


```js
    {
      // Unique Open VSX extension ID in the form "<namespace>.<name>"
      "id": "redhat.vscode-yaml",
      // Repository URL to clone and publish from
      "repository": "https://github.com/redhat-developer/vscode-yaml"
    },
```

Here are all the supported values, including optional ones, to build extensions from source:

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
      "prepublish": "npm run build",
      // (OPTIONAL) Relative path of the extension vsix file inside the git repo (i.e. when it is built by prepublish commands
      "extensionFile": "dist/js-debug.vsix",
      // (OPTIONAL) Enables publishing of web extensions.
      "web": true
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
