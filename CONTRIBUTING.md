Thanks for stopping by and willing to contribute to `publish-extensions`! Below are some general rules to obide by when contributing extensions to the repository.

## When to Add an Extension?

A goal of Open VSX is to have extension maintainers publish their extensions [according to the documentation](https://github.com/eclipse/openvsx/wiki/Publishing-Extensions). The first step we recommend is to open an issue with the extension owner. If the extension owner is unresponsive for some time, this repo (`publish-extensions`) can be used **as a temporary workaround** to ensure the extension is published to Open VSX.

In the long-run it is better for extension owners to publish their own extensions because:

1. Any future issues (features/bugs) with any published extensions in Open VSX will be directed to their original repo/source-control, and not confused with this repo `publish-extensions`.
2. Extensions published by official authors are shown within the Open VSX marketplace as such. Whereas extensions published via `publish-extensions` as <kbd>Published by
   open-vsx</kbd>.
3. Extension owners who publish their own extensions get greater flexibility on the publishing/release process, therefore ensure more accuracy/stability. For instance, in some cases `publish-extensions` has build steps within this repository, which can cause some uploaded extension versions to break (e.g. if an extensions's build step changes).

⚠️ We only accept extensions with an [OSI-approved open source license](https://opensource.org/licenses) here. If you want to have an extension with a proprietary or non-approved license published, please ask its maintainers to publish it [^proprietary].

Now that you know whether you should contribute, let's learn how to contribute! Read on in [DEVELOPMENT.md](DEVELOPMENT.md)

## Other contributions

Contributions involving docs, publishing processes and others should be first discussed in an issue. This is not necessary for small changes like typo fixes.

[publish-extensions-job]: https://github.com/open-vsx/publish-extensions/blob/master/.github/workflows/publish-extensions.yml

[^ms]: [The Microsoft Visual Studio Code Extensions Marketplace](https://marketplace.visualstudio.com/)
[^proprietary]: proprietary extensions are allowed on https://open-vsx.org, but cannot be published through this repository

