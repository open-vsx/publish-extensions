## Issue title

```md
Publish `EXTENSION_NAME` to Open VSX
```

## Issue body

```md
Dear extension author,
Please publish this extension to the Open VSX marketplace.

## Context

Unfortunately, as Microsoft prohibits usages of the Microsoft marketplace by any other products or redistribution vsix files from it, in order to use VS Code extensions in non-Microsoft products, we kindly ask that you take ownership of the VS Code extension namespace in [OpenVSX](https://open-vsx.org/) and publish this extension on Open VSX.

## What is OpenVSX? Why does it exist?

OpenVSX is a vendor neutral alternative to the MS marketplace used by most other derivatives of VS Code like [VSCodium](https://vscodium.com/), [Gitpod](gitpod.io), [OpenVSCode](https://github.com/gitpod-io/openvscode-server), [Theia](https://theia-ide.org/) based IDEs, and so on.

## How can you publish to Open VSX?

The docs to publish an extension can be found [here](https://github.com/eclipse/openvsx/wiki/Publishing-Extensions). This process is straightforward and shouldn't take too long. Essentially, you need an authentication token and to execute the command `ovsx publish` to publish your plugin. See this example from RedHat publishes their Java extension: [redhat-developer/vscode-java@ff51dbf/Jenkinsfile#L73-L82](https://github.com/redhat-developer/vscode-java/blob/5d4f8d58b8e919534800ca7bc41e8513c288f573/Jenkinsfile#L78-L82)
You can also find [an example PR](https://github.com/PeterWone/vsc-print/pull/121) that contributes a release GitHub Action which publishes to GitHub, MS and OpenVSX at the same time.
```
