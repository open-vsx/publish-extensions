# Contributing to Eclipse Open VSX Publish Extensions

Thanks for stopping by and willing to contribute to `publish-extensions`! Below are some general rules to abide by when contributing to the repository.

## Code of Conduct

This project is governed by the [Eclipse Community Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## Communication

The following communication channels are available:

-   [publish-extensions issues](https://github.com/open-vsx/publish-extensions/issues) - for general issues (bug reports, feature requests, etc.)
-   [open-vsx.org issues](https://github.com/EclipseFdn/open-vsx.org/issues) - for issues related to [open-vsx.org](https://open-vsx.org/) (outage reports, requests about extensions and namespaces, etc.)
-   [Developer mailing list](https://accounts.eclipse.org/mailing-list/openvsx-dev) - for organizational issues (e.g. elections of new committers)

## How to Contribute

Before your pull request can be accepted, you must electronically sign the [Eclipse Contributor Agreement](https://www.eclipse.org/legal/ECA.php).

Unless you are an elected committer of this project, you must include a `Signed-off-by` line in the commit message. This line can be generated with the [-s flag of git commit](https://git-scm.com/docs/git-commit#Documentation/git-commit.txt--s). By doing this you confirm that your contribution conforms to the Eclipse Contributor Agreement.

For more information, see the [Eclipse Foundation Project Handbook](https://www.eclipse.org/projects/handbook/#resources-commit).

## When to Add an Extension?

A goal of Open VSX is to have extension maintainers publish their extensions [according to the documentation](https://github.com/eclipse/openvsx/wiki/Publishing-Extensions)[^guide]. The first step we recommend is to open an issue with the extension owner[^issue]. If the extension owner is unresponsive for some time, this repo (`publish-extensions`) can be used **as a temporary workaround** to ensure the extension is published to Open VSX.

In the long-run it is better for extension owners to publish their own extensions because:

1. Any future issues (features/bugs) with any published extensions in Open VSX will be directed to their original repo/source-control, and not confused with this repo `publish-extensions`.
2. Extensions published by official authors are shown within the Open VSX marketplace as such. Whereas extensions published via `publish-extensions` as <kbd>Published by
   open-vsx</kbd>.
3. Extension owners who publish their own extensions get greater flexibility on the publishing/release process, therefore ensure more accuracy/stability. For instance, in some cases `publish-extensions` has build steps within this repository, which can cause some uploaded extension versions to break (e.g. if an extensions's build step changes).

> **Warning**: We only accept extensions with an [OSI-approved open source license](https://opensource.org/licenses) here. If you want to have an extension with a proprietary or non-approved license published, please ask its maintainers to publish it[^proprietary].

Now that you know whether you should contribute, let's learn how to contribute! Read on in [DEVELOPMENT.md](DEVELOPMENT.md).

## Other contributions

Contributions involving docs, publishing processes and others should be first discussed in an issue. This is not necessary for small changes like typo fixes.

[^proprietary]: Proprietary extensions are allowed on https://open-vsx.org, but cannot be published through this repository
[^guide]: We have our own guide for extension authors with the whole publishing process: [direct_publish_setup.md](docs/direct_publish_setup.md)
[^issue]: We have a document that can be used as a template for these kinds of issues: [external_contribution_request.md](docs/external_contribution_request.md)
