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
    ExtensionQueryFlags.IncludeVersions,
    ExtensionQueryFlags.IncludeVersionProperties
];

const checkAmount = 64;


(async function () {
    /**
     * @type {Readonly<import('../types').Extensions>}
     */
     const extensionsToPublish = JSON.parse(await fs.promises.readFile('./extensions.json', 'utf-8'));

    /** @type {import('../types').SingleExtensionQueryResult[]} */
    const topExtensions = await msGalleryApi.extensionQuery({ pageSize: checkAmount, criteria: [{ filterType: 8, value: "Microsoft.VisualStudio.Code" }, { filterType: 12, value: "4096" }] });

    /** @type {import('../types').SingleExtensionQueryResult[]} */
    let notInOvsx = [];


    for (const extension of topExtensions) {
        let [msExtension] = await Promise.allSettled([openGalleryApi.getExtension(`${extension.publisher.publisherName}.${extension.extensionName}`, flags)]);
        if (msExtension.status === "fulfilled") {
            if (!msExtension.value?.versions[0]?.version) {
                notInOvsx.push(extension);
                console.log(`Extension not in OpenVSX: ${extension.publisher.publisherName}.${extension.extensionName}`)
            }
        }
    }

    const microsoftUnpublished = notInOvsx.filter(extension => extension.publisher.domain === 'https://microsoft.com' && extension.publisher.isDomainVerified);
    const definedInRepo = notInOvsx.filter(extension => extensionsToPublish[`${extension.publisher.publisherName}.${extension.extensionName}`]);

    let summary = '----- Summary -----\r\n';
    summary += `Total: ${checkAmount}\r\n`;
    summary += `Not published to OpenVSX: ${notInOvsx.length} (${((notInOvsx.length / checkAmount) * 100).toFixed(4)}%)\r\n`;
    summary += `Not in OpenVSX but defined in our repo: ${definedInRepo.length} (${((definedInRepo.length / notInOvsx.length) * 100).toFixed(4)}%)\r\n`;
    summary += `Not published from Microsoft: ${microsoftUnpublished.length} (${((microsoftUnpublished.length / checkAmount) * 100).toFixed(4)}% of all unpublished)\r\n`;

    console.log(summary);
}());
