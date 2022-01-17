# Publishing an extension to OpenVSX on your own

It is hightly advised that extension authors publish their extensions to OpenVSX as a part of their CI/CD process. See [our reasoning why that is](https://github.com/open-vsx/publish-extensions#when-to-add-an-extension).

We have a simple template for setting a workflow with GitHub Actions which can help you kickstart your own. This template includes some neat features like:

- Publishing to GitHub Releases, the Microsoft Marketplace and OpenVSX
- Uploading the `.vsix` package to GitHub Releases as assets
- Manual triggers that allow you to select what places to release to
- Automatic triggers from new GitHub Releases

## Setup

1. First, follow the [Publishing Extensions](https://github.com/eclipse/openvsx/wiki/Publishing-Extensions) doc and take note of the access token that is returned, as you will require it in the next step.

2. To run the GitHub Action above, you need to setup two repository secrets for the Action to use:

   - `VSCE_PAT` - the token for publishing to Microsoft's Marketplace (["Get a Personal Access Token" in VS Code's docs](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#get-a-personal-access-token))
   - `OVSX_PAT` - the token for publishing to OpenVSX. You got this in the previous sttep

3. In your extension repo, [create a GitHub Action](https://docs.github.com/en/actions/learn-github-actions/understanding-github-actions#create-an-example-workflow) with the contents of [this template](https://github.com/open-vsx/publish-extensions/blob/328222de4a926506731ea2cccd6542e3bdc55afb/docs/exampleCI.yaml). You can customize this however you like, for instance:
   - you can customize the [release tag](https://github.com/open-vsx/publish-extensions/blob/328222de4a926506731ea2cccd6542e3bdc55afb/docs/exampleCI.yaml#L60) or the [release name](https://github.com/open-vsx/publish-extensions/blob/328222de4a926506731ea2cccd6542e3bdc55afb/docs/exampleCI.yaml#L108)
   - you can customize what the [packaging process behaves and executes](https://github.com/open-vsx/publish-extensions/blob/328222de4a926506731ea2cccd6542e3bdc55afb/docs/exampleCI.yaml#L32)
   - you can customize the [workflow triggers](https://github.com/open-vsx/publish-extensions/blob/328222de4a926506731ea2cccd6542e3bdc55afb/docs/exampleCI.yaml#L2) to better fit in your workflow. See [Events that trigger workflows](https://docs.github.com/en/actions/learn-github-actions/events-that-trigger-workflows) for all the possible options. 
4. Now you can test whether your config works by commiting the Action file and running it from the Actions tab in your repo (select your workflow on the left and hit <kbd>Run Workflow</kbd> on the top right).
    - note this will not work if you have removed the `workflow_dispatch` trigger for the workflow. You will need to trigger the Action some other way (e.g. creating a blank GitHub Release)