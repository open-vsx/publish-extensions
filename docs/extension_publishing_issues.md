# Bugs with extensions

## Bugs in extensions' behaviors

If an extension you downloaded from OpenVSX is misbehaving, please do the following:

1. check the extension version on [OpenVSX](https://open-vsx.org/) (you can see the latest one in the right sidebar)
2. check the extension version on the [VS Code Marketplace](https://marketplace.visualstudio.com/) (you can find the version on the bottom of the right-hand side bar)
3. If the versions don't match, it's probably a problem with the publishing process, so continue to the next chapter of this guide
4. If they are the same version, please go to the problematic extension's repository and try to deal with the issue there.

We cannot help with broken extensions; these issues have to be addressed with their respective maintainers.

If the extension at hand has been unmaintained for a longer period of time, please [raise an issue](https://github.com/open-vsx/publish-extensions/issues/new) by selecting <kbd>Other</kbd> as the issue template and adding the necessary information (we will publish the last version by building manually and remove the extension from this repository).

## Errors in the publishing process

1. If an extension on OpenVSX is outdated, this is probably due to one of two things:
    1. The extension has some abnormal build prerequisites, we build everything inside the same Ubuntu VM, which might cause problems like:
        - a CLI tool is not installed
        - the extension requires an older/newer version of Node.js: we are using Node 14 for everything.
        - the extension has issues building on the latest LTS of Ubuntu server (we use `ubuntu-latest` for our jobs, you can take a look at [GitHub's Docs](https://github.com/actions/virtual-environments#available-environments) to see what that currently stands for)
    2. The extension requires additional commands to be executed to build successfully. 
        - if you want a quick and easy fix you can try adding a `prepublish` property to the extension in `extensions.json` to set a command to be executed before packaging up the extension, right after installing the project's depenedencies.

    The best way to solve this issue is to publish the extension from its own repository, not this one. 
    - If you are the extension author, you can use [this document](direct_publish_setup.md) for a guide on setting that up.
    - If you are a community member you can raise an issue (if there is none discussing it already) using [this template](external_contribution_request.md). If the maintainers are willing to accept a contribution you can use the [same document listed in the point above](direct_publish_setup.md) to quickly setup a CI job with GitHub Actions.