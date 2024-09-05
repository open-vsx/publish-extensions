# Publishing an extension to Open VSX on your own

We advise extension authors to publish their extensions to Open VSX as a part of their CI/CD process. See [our reasoning why that is](https://github.com/open-vsx/publish-extensions/blob/master/CONTRIBUTING.md#when-to-add-an-extension).

To make the Open VSX publishing process easier, we have provided a template of a GitHub Actions workflow.

The template performs the following:

-   Publishing to GitHub Releases, the Microsoft Marketplace and Open VSX
-   Uploading the `.vsix` package to GitHub Releases as assets
-   Manually triggers releases and publishing to Open VSX and/or Microsoft Marketplace.
-   Automatic triggers from new GitHub Releases

## Setup VS Code extension publishing CI workflow

1. First, follow the [Publishing Extensions](https://github.com/eclipse/openvsx/wiki/Publishing-Extensions) doc (only steps 1-4 are required) and take note of the access token that is returned, as you will require it in the next step.

2. To run the GitHub Action above, you need to setup two repository secrets for the Action to use:

    - `VSCE_PAT` - the token for publishing to Microsoft's Marketplace (["Get a Personal Access Token" in VS Code's docs](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#get-a-personal-access-token))
    - `OVSX_PAT` - the token for publishing to Open VSX. This token was displayed in your https://open-vsx.org user dashboard.

3. In your extension repo, [create a GitHub Action](https://docs.github.com/en/actions/learn-github-actions/understanding-github-actions#create-an-example-workflow) with the contents of [this template](exampleCI.yaml). You can customize this however you like, for instance:
    - you can customize the [release tag](exampleCI.yaml#L60) or the [release name](exampleCI.yaml#L108)
    - you can customize what the [packaging process behaves and executes](exampleCI.yaml#L32)
    - you can customize the [workflow triggers](exampleCI.yaml#L2) to better fit in your workflow. See [Events that trigger workflows](https://docs.github.com/en/actions/learn-github-actions/events-that-trigger-workflows) for all the possible options.
4. Now you can test whether your config works by committing the Action file and running it from the Actions tab in your repo (select your workflow on the left and hit <kbd>Run Workflow</kbd> on the top right).
    - note this will not work if you have removed the `workflow_dispatch` trigger for the workflow. You will need to trigger the Action some other way (e.g. creating a blank GitHub Release)
