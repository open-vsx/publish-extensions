## Issue title

Publish `EXTENSION_NAME` to Open VSX

## Issue body

Please consider publishing the extension to the OpenVSX registry. 

We are running the Web version of VS Code at Gitpod. The problem is, that only Microsoft products like VS Code may use the MS VS Code extensions Marketplace, so we must use Open VSX instead. It is a vendor neutral alternative. Also, products like VSCodium, Theia, code-server many other projects are using the registry to allow their users to install extensions. 

Here's a couple of words about why it might not be the best idea to let someone from the community add this extension to [open-vsx/publish-extensions](https://github.com/open-vsx/publish-extensions): https://github.com/open-vsx/publish-extensions#when-to-add-an-extension.

The docs for publishing the extension are here: https://github.com/eclipse/openvsx/wiki/Publishing-Extensions. Technically this should be straightforward. You basically must get a token and call `ovsx publish` with it. For example, this is how RedHat publishes their java extension: redhat-developer/vscode-java@ff51dbf/Jenkinsfile#L73-L82