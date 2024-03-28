// This script automatically updates ./extensions.json with the latest changes from upstream.
// usage: bun update.ts

import { diff } from "jest-diff";

// https://github.com/microsoft/vscode/blob/a2acd131e47500cf4bd7d602626f0b54ab266904/src/vs/platform/extensionManagement/common/extensionManagement.ts#L314
interface ISearchPrefferedResults {
    readonly query?: string;
    readonly preferredResults?: string[];
}

export type IStringDictionary<V> = Record<string, V>;

// https://github.com/microsoft/vscode/blob/a2acd131e47500cf4bd7d602626f0b54ab266904/src/vs/platform/extensionManagement/common/extensionGalleryService.ts#L563
interface IRawExtensionsControlManifest {
    malicious: string[];
    migrateToPreRelease?: IStringDictionary<{
        id: string;
        displayName: string;
        migrateStorage?: boolean;
        engine?: string;
    }>;
    deprecated?: IStringDictionary<
        | boolean
        | {
              disallowInstall?: boolean;
              extension?: {
                  id: string;
                  displayName: string;
              };
              settings?: string[];
          }
    >;
    search?: ISearchPrefferedResults[];
}

const existsOnOpenVSX = async (id: string) => {
    const response = await fetch(`https://open-vsx.org/api/${id.replace(/\./g, "/")}`);
    if (response.ok) {
        console.log(`Extension ${id} exists on OpenVSX.`);
        return true;
    }

    console.log(`Extension ${id} does not exist on OpenVSX.`);
    return false;
};

const latestData = await fetch("https://az764295.vo.msecnd.net/extensions/marketplace.json");
const latestJson = (await latestData.json()) as IStringDictionary<IRawExtensionsControlManifest>;

const localFile = Bun.file("./extensions.json");
const localData = JSON.parse(await localFile.text()) as IStringDictionary<IRawExtensionsControlManifest>;
const updatedData = structuredClone(localData);

for (const key of Object.values(latestJson.malicious)) {
    if (!localData.malicious.includes(key)) {
        const exists = await existsOnOpenVSX(key);
        if (exists) {
            updatedData.malicious.push(key);
        }
    }
}

const missingDependency = [];
for (const key of Object.keys(latestJson.deprecated)) {
    if (key in localData.deprecated) {
        continue;
    }

    const extensionsToCheck = [key];
    const value = latestJson.deprecated[key];
    if (typeof value === "object" && value.extension) {
        extensionsToCheck.push(value.extension.id);
    }

    // Ensure both extensions exist on OpenVSX, if only key exists, set its entry to true instead of the original object
    const exists = await Promise.all(extensionsToCheck.map(existsOnOpenVSX));
    if (exists.every((x) => x)) {
        updatedData.deprecated[key] = latestJson.deprecated[key];
    }

    if (exists.length === 2 && exists[0] && !exists[1]) {
        missingDependency.push(key);
    }
}

for (const key of Object.keys(latestJson.migrateToPreRelease)) {
    if (key in localData.migrateToPreRelease) {
        continue;
    }

    const exists = await existsOnOpenVSX(key);
    if (exists) {
        updatedData.migrateToPreRelease[key] = latestJson.migrateToPreRelease[key];
    }
}

const totalNumberBefore = Object.keys(localData)
    .map((x) => Object.keys(localData[x]).length)
    .reduce((a, b) => a + b, 0);

const totalNumberAfter = Object.keys(updatedData)
    .map((x) => Object.keys(updatedData[x]).length)
    .reduce((a, b) => a + b, 0);

console.log(`Total number of entries before: ${totalNumberBefore}`);
console.log(`Total number of entries after: ${totalNumberAfter}`);

console.log(missingDependency);

console.log(diff(updatedData, localData));

Bun.write(localFile, JSON.stringify(updatedData, null, 4));
