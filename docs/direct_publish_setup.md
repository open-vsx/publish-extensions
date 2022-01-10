# Publishing an extension to OpenVSX on your own

It is hightly advised that extension authors publish their extensions to OpenVSX as a part of their CI/CD process. See [our reasoning why that is](https://github.com/open-vsx/publish-extensions#when-to-add-an-extension). 

We have a simple template for setting a workflow with GitHub Actions which can help you kickstart your own. This template includes some neat features like:
- Publishing to GitHub Releases, the Microsoft Marketplace and OpenVSX
- Uploading the `.vsix` package to GitHub Releases as assets
- Manual triggers that allow you to select what places to release to
- Automatic triggers from new GitHub Releases

## Setup

1. The first step is is to follow the [Publishing Extensions](https://github.com/eclipse/openvsx/wiki/Publishing-Extensions) doc and take note of the access token that you get as you will need it in the next step. 

2. In order to run this the Action above, you need to setup two repository secrets for the Action to use:
    - `VSCE_PAT` - the token for publishing to Microsoft's Marketplace (["Get a Personal Access Token" in VS Code's docs](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#get-a-personal-access-token))
    - `OVSX_PAT` - the token for publishing to OpenVSX. You got this in the previous sttep
