<!--

### For extension authors

`publish-extensions` exists to seed the Open VSX marketplace, and also serves as a place for extensions that cannot feasibly be published directly by the extensions authors. In the long-run it is better for extension owners to publish their own plugins because:

1. Any future issues (features/bugs) with any published extensions in Open VSX will be directed to their original repo/source-control, and not confused with this repo publish-extensions.
2. Extensions published by official authors are shown within the Open VSX marketplace as such. Whereas extensions published via publish-extensions display a warning that the publisher (this repository) is not the official author.
3. Extension owners who publish their own extensions get greater flexibility on the publishing/release process, therefore ensure more accuracy/stability. For instance, in some cases publish-extensions has build steps within this repository, which can cause some uploaded plugin versions to break (e.g. if a plugin build step changes).

If you are the author of the extension being raised in this PR, please first consider directly publishing the extension yourself. You can refer to our [direct publish setup](docs/direct_publish_setup.md) doc for a guide on how to publish your plugin to Open VSX.

### For community contributors

For the sake of efficiency and simplicity, the easiest way to publish an extension is by having it published by its maintainers, for more info about this please refer to the [README](https://github.com/open-vsx/publish-extensions#when-to-add-an-extension). If the authors are open to publish the extension to Open VSX, you can help them by contributing a GitHub Action using our handy-dandy [direct publish setup](docs/direct_publish_setup.md) doc.

 - If the extension is unmaintained, please create an issue for it instead.

For Work In Progress Pull Requests, please use the Draft PR feature,
see https://github.blog/2019-02-14-introducing-draft-pull-requests/ for further details.

-->

-   [ ] I have read the note above about PRs contributing or fixing extensions
-   [ ] I have tried reaching out to the extension maintainers about publishing this extension to Open VSX (if not, please create an issue in the extension's repo using [this template](https://github.com/open-vsx/publish-extensions/blob/HEAD/docs/external_contribution_request.md)).
-   [ ] This extension has an [OSI-approved OSS license](https://opensource.org/licenses) (we don't accept proprietary extensions in this repository)

## Description

<!-- Please do not leave this blank -->

This PR introduces X change for Y reason.
