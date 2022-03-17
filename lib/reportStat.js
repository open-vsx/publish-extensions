/********************************************************************************
 * Copyright (c) 2022 TypeFox and others
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * SPDX-License-Identifier: EPL-2.0
 ********************************************************************************/

// @ts-check
const fs = require('fs');
const { getPublicGalleryAPI } = require('vsce/out/util');
const { PublicGalleryAPI } = require('vsce/out/publicgalleryapi');
const { ExtensionQueryFlags } = require('azure-devops-node-api/interfaces/GalleryInterfaces');

const msGalleryApi = getPublicGalleryAPI();
msGalleryApi.client['_allowRetries'] = true;
msGalleryApi.client['_maxRetries'] = 5;

const openGalleryApi = new PublicGalleryAPI('https://open-vsx.org/vscode', '3.0-preview.1');
openGalleryApi.client['_allowRetries'] = true;
openGalleryApi.client['_maxRetries'] = 5;
openGalleryApi.post = (/** @type {string} */ url, /** @type {string} */ data, /** @type {import("typed-rest-client/Interfaces").IHeaders} */ additionalHeaders) =>
    openGalleryApi.client.post(`${openGalleryApi.baseUrl}${url}`, data, additionalHeaders);

const flags = [
    ExtensionQueryFlags.IncludeStatistics,
];

const checkAmount = 128;

const cannotPublish = [
    // We cannot redistribute under their license: https://github.com/microsoft/vscode-cpptools/tree/main/RuntimeLicenses
    'ms-vscode.cpptools',
    'ms-vscode.cpptools-extension-pack',
    'ms-dotnettools.csharp', // We cannot redistribute under their license: https://github.com/OmniSharp/omnisharp-vscode/tree/master/RuntimeLicenses

    // Dependent on ms-dotnettools.csharp
    'vsciot-vscode.vscode-arduino',
    'Unity.unity-debug',

    // Code is proprietary
    'ms-python.vscode-pylance',
    'VisualStudioExptTeam.vscodeintellicode',
    'ms-vscode-remote.remote-wsl',
    'ms-vscode-remote.remote-containers',
    'ms-vscode-remote.remote-ssh',
    'ms-vscode-remote.remote-ssh-edit',
    'ms-vscode-remote.vscode-remote-extensionpack',
    'MS-vsliveshare.vsliveshare',
    'MS-vsliveshare.vsliveshare-pack',
    'MS-vsliveshare.vsliveshare-audio',

    // GitHub Proprietary
    'GitHub.copilot',
    'GitHub.remotehub',
    'GitHub.codespaces',

    // Deprecated
    'eg2.tslint',
];

/**
 * Checks missing extensions from OpenVSX
 * @param {boolean} silent 
 * @returns 
 */
const checkMissing = async (silent = false) => {
    /**
     * @type {Readonly<import('../types').Extensions>}
     */
    const extensionsToPublish = JSON.parse(await fs.promises.readFile('./extensions.json', 'utf-8'));

    /** @type {import('../types').SingleExtensionQueryResult[]} */
    const topExtensions = await msGalleryApi.extensionQuery({ pageSize: checkAmount, criteria: [{ filterType: 8, value: "Microsoft.VisualStudio.Code" }, { filterType: 12, value: "4096" }], flags });

    /** @type {import('../types').SingleExtensionQueryResult[]} */
    let notInOvsx = [];

    for (const extension of topExtensions) {
        let [openExtension] = await Promise.allSettled([openGalleryApi.getExtension(`${extension.publisher.publisherName}.${extension.extensionName}`, flags)]);
        const id = `${extension.publisher.publisherName}.${extension.extensionName}`;
        const popularExtension = extension.statistics?.find(s => s.statisticName === 'install')?.value < 1_000_000;
        if (openExtension.status === "fulfilled") {
            if (!openExtension.value?.publisher.publisherId) {
                notInOvsx.push(extension);
                if (!silent) {
                    if (cannotPublish.includes(id)) {
                        console.log(`🟢 Extension not in OpenVSX: ${extension.publisher.publisherName}.${extension.extensionName}`)
                    } else {
                        console.log(`${popularExtension ? '🔴' : '🟡'} Extension not in OpenVSX : ${extension.publisher.publisherName}.${extension.extensionName}`)
                    }
                }
            }
        }
    }

    const microsoftUnpublished = notInOvsx.filter(extension => ['https://microsoft.com', 'https://github.com'].includes(extension.publisher.domain) && extension.publisher.isDomainVerified);
    const definedInRepo = notInOvsx.map(ext => `${ext.publisher.publisherName}.${ext.extensionName}`).filter(id => extensionsToPublish[id]);

    const microsoftCouldPublish = microsoftUnpublished.map(extension => `${extension.publisher.publisherName}.${extension.extensionName}`).filter(id => !cannotPublish.includes(id));

    let summary = '----- Summary -----\r\n';
    summary += `Total: ${checkAmount}\r\n`;
    summary += `Not published to OpenVSX: ${notInOvsx.length} (${((notInOvsx.length / checkAmount) * 100).toFixed(4)}%)\r\n`;
    summary += `Not in OpenVSX but defined in our repo: ${definedInRepo.length} (${((definedInRepo.length / notInOvsx.length) * 100).toFixed(4)}%)\r\n`;
    summary += `Not published from Microsoft: ${microsoftUnpublished.length} (${((microsoftUnpublished.length / checkAmount) * 100).toFixed(4)}% of all unpublished)\r\n`;

    summary += 'Microsoft extensions we should publish: \r\n'
    summary += microsoftCouldPublish.join();

    if (!silent) console.log(summary);

    return {
        missing: notInOvsx,
        missingMs: microsoftUnpublished,
        couldPublishMs: microsoftCouldPublish,
        definedInRepo
    }
}

exports.checkMissing = checkMissing;