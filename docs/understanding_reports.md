# Understanding statistics

This document is here to help you understand reports from [the nightly publishing job](https://github.com/open-vsx/publish-extensions/actions/workflows/publish-extensions.yml).

## How to gather these statistics

If you click on a job in the GitHub Actions tab, there is an `Artifacts` section at the bottom of the page, from which you can download the `report`, which after unarchiving reveals three files: `result.md`, `stat.json` and `meta.json`.

## `stat.json`

This is the machine-readable data that the next file - `result.md` is generated from. In it, you can find 9 different categories of extensions:

-   `upToDate` - these extensions are the extensions, which have the same version published to Open VSX as well as the Microsoft Marketplace.
-   `outdated` are all of the extensions, which have versions on Open VSX, which are behind the ones on the Microsoft Marketplace.
-   `unstable` is the category, which has all extensions, that are most likely incorrectly published from the extensions' nightly or beta builds, since on the Microsoft Marketplace has a version which is smaller than the one on Open VSX.
-   `notInOpen` includes extensions that simply failed to ever be published to Open VSX, which means they should get special attention - fix them or remove them :)
-   `notInMs` - extensions that aren't published on the Microsoft Marketplace
-   `failed` - the extensions that for some reason failed with their publishing.
-   `msPublished` - all extensions published by Microsoft Corporation.
-   `hitMiss` - extensions which, in <abbr title="Month-To-Date">MTD</abbr>, have been updated on Open VSX within 2 days after the Microsoft Marketplace.
-   `resolutions` is a list of all extensions and the way they have been resolved: `latest`, `matchedLatest`. `releaseTag`, `tag` or `releaseAsset`.

## `result.md`

This file is the one that should provide a quick overview of how the repository is doing. It has many percentages, numbers and sections, so that you can quickly take a look and get the information you want. These are mostly made from the `stat.json` file and pretty self-explanatory, but there are some that are a bit more complex:

### `Weighted publish percentage`

This metric's goal is to provide the one number you need to see if the big and most used extensions are up-to-date and existing on Open VSX. This value is computed as follows (in pseudo-code):

```ts
const upToDateInstalls = sum(upToDate); // a sum of all installs on the Microsoft Marketplace of all up-to-date extensions
const totalInstalls = sum(upToDate); // a sum of all install from the Microsoft Marketplace across both up-to-date extensions, as well as outdated, unstable and failing to publish at all

const weightedPublishPercentage = upToDateInstalls / totalInstalls;
```

### Microsoft-published extensions

In the `Summary`, you can see a how many extensions published by Microsoft are defined in our repo, how many of them are outdated and how many of them are unstable. For further details with all of the failing extensions, refer to the `MS extensions` section in the file. Under there, you can find more details, like the specific IDs of the extensions and their install counts.

## `meta.json`

Contains metadata that can be used by other jobs wanting to examine data from previous runs. It is not intended to be read by humans.
