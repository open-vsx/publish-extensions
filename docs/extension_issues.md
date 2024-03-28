# Bugs with extensions

## Functional bugs in VS Code extensions

If an extension you downloaded from Open VSX isn't functioning as expected, please follow these steps to debug:

1. check the extension version on [Open VSX](https://open-vsx.org/) (you can see the latest one in the right sidebar)
2. check the extension version on the [VS Code Marketplace](https://marketplace.visualstudio.com/) (you can find the version on the bottom of the right-hand side bar)
3. If the versions don't match, it's probably a problem with the publishing process, so continue to the next chapter of this guide
4. If they are the same version, visit the extension's source repository to investigate the issue further.

**Important:** We (`publish-extensions` maintainers) cannot help with functionally broken extensions; these issues should be raised with the respective maintainers.

If the extension has been unmaintained for a longer period of time, and maintainers are not responding to requests to publish or update the extension, [raise an issue](https://github.com/open-vsx/publish-extensions/issues/new) and select <kbd>Other</kbd> as the GitHub issue template, adding the necessary information (we publish the latest version by building manually and remove the extension from this repository).

## Errors in the publishing process

If an extension on Open VSX is outdated or has never been successfully published (despite being listed in [`extensions.json`](https://github.com/open-vsx/publish-extensions/blob/HEAD/extensions.json)), the cause is likely one of the following:

1. The extension has some abnormal build prerequisites, we build everything inside the same Ubuntu VM, which might cause problems like:
    - a CLI tool is not installed
    - the extension requires an older/newer version of Node.js: we are using Node 14 by default, although this can be fixed by extensions specifying a different Node version using the [`.nvmrc`](https://github.com/nvm-sh/nvm#nvmrc) file in their repository.
    - the extension has issues building on the latest LTS of Ubuntu server (we use `ubuntu-latest` for our jobs, you can take a look at [GitHub's Docs](https://github.com/actions/runner-images#available-images) to see what that currently stands for)
2. The extension requires additional commands to be executed to build successfully.
    - if you want a quick and easy fix you can try adding a `prepublish` property to the extension in `extensions.json` to set a command to be executed before packaging up the extension, right after installing the project's dependencies.

The best way to solve issues of failed publishing is to publish the extension from its own repository, not this one.

-   If you are the extension author, you can use [this document](direct_publish_setup.md) as a guide on how to set up a CI publishing process.
-   If you are a community member you can raise an issue (please check for existing issues) using [this template](external_contribution_request.md). If the maintainers are willing to accept a contribution you can use the [same document listed in the point above](direct_publish_setup.md) to quickly setup a CI job with GitHub Actions.
