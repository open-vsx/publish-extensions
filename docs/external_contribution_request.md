## Issue title

```md
Publish `EXTENSION_NAME` to Open VSX
```

## Issue body

```md
Dear extension author,
Please publish this extension to the Open VSX marketplace.

## Context

Unfortunately, as Microsoft prohibits usages of the Microsoft marketplace by any other products or redistribution of `.vsix` files from it, in order to use VS Code extensions in non-Microsoft products, we kindly ask that you take ownership of the VS Code extension namespace in [Open VSX](https://open-vsx.org/) and publish this extension on Open VSX.

## What is Open VSX? Why does it exist?

Open VSX is a vendor neutral alternative to the MS marketplace used by most other derivatives of VS Code like [VSCodium](https://vscodium.com/), [Gitpod](https://www.gitpod.io), [OpenVSCode](https://github.com/gitpod-io/openvscode-server), [Theia](https://theia-ide.org/)-based IDEs, and so on.

You can read on about Open VSX at the Eclipse Foundation's [Open VSX FAQ](https://www.eclipse.org/legal/open-vsx-registry-faq/).

## How can you publish to Open VSX?

The docs to publish an extension can be found [here](https://github.com/eclipse/openvsx/wiki/Publishing-Extensions). This process is straightforward and shouldn't take too long. Essentially, you need an authentication token and to execute the `ovsx publish` command to publish your extension. There's also [a doc](https://github.com/open-vsx/publish-extensions/blob/master/docs/direct_publish_setup.md) explaining the whole process with an example GitHub Action workflow.
```
