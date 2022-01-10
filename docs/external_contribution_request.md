## Issue title

Publish `EXTENSION_NAME` to Open VSX

## Issue body

Unfortunately MS prohibits usages of MS marketplace by any other products or redistribution vsix files from it. Because of it we kindly ask you to take the ownership of your namespace in [OpenVSX](https://open-vsx.org/) and publish there as well.

OpenVSX is a vendor neutral alternative to MS marketplace used by all other derivatives of VS Code like [VSCodium](https://vscodium.com/), [Gitpod](gitpod.io), [OpenVSCode](https://github.com/gitpod-io/openvscode-server), [Theia](https://theia-ide.org/) based IDEs, and so on.

The docs for publishing the extension are [here](https://github.com/eclipse/openvsx/wiki/Publishing-Extensions). Technically this should be straightforward. You get a token and call `ovsx publish` with it. For example, this is how RedHat publishes their Java extension: [redhat-developer/vscode-java@ff51dbf/Jenkinsfile#L73-L82](https://github.com/redhat-developer/vscode-java/blob/5d4f8d58b8e919534800ca7bc41e8513c288f573/Jenkinsfile#L78-L82)

[Here](https://github.com/PeterWone/vsc-print/pull/121) is also an example PR that contributes a release GitHub Action which can publish to GitHub, MS and OpenVSX at the same time. Let @filiptronicek or @akosyakov know if you are open to a PR contributing such GitHub Action. They would gladly help out, even if there are just some questions or suggestions.

Gitpod as well supports open-source developers by providing unlimited access to their platform. Feel free to reach out via https://www.gitpod.io/docs/professional-open-source