/********************************************************************************
 * Copyright (c) 2021 Gitpod and others
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * SPDX-License-Identifier: EPL-2.0
 ********************************************************************************/

// @ts-check
const fs = require('fs');

/**
 * @param {{ [id: string]: (import('./types').ExtensionStat | import('./types').ExtensionStat) }} s 
 */
function sortedKeys(s) {
    return Object.keys(s).sort((a, b) => {
        if (typeof s[b].msInstalls === 'number' && typeof s[a].msInstalls === 'number') {
            return s[b].msInstalls - s[a].msInstalls;
        }
        if (typeof s[b].msInstalls === 'number') {
            return s[b].msInstalls;
        }
        return -1;
    })
}

(async () => {
    /** @type{import('./types').PublishStat}*/
    const stat = JSON.parse(await fs.promises.readFile("/tmp/stat.json", { encoding: 'utf8' }));

    const upToDate = Object.keys(stat.upToDate).length;
    const unstable = Object.keys(stat.unstable).length;
    const outdated = Object.keys(stat.outdated).length;
    const notInOpen = Object.keys(stat.notInOpen).length;
    const notInMS = stat.notInMS.length;
    const total = upToDate + notInOpen + outdated + unstable + notInMS;
    const updatedInMTD = Object.keys(stat.hitMiss).length;
    const updatedInOpen = Object.keys(stat.hitMiss).filter(id => stat.hitMiss[id].hit).length;
    const msPublished = Object.keys(stat.msPublished).length;

    let summary = '----- Summary -----\r\n';
    summary += `Total: ${total}\r\n`;
    summary += `Up-to-date (MS Marketplace == Open VSX): ${upToDate} (${(upToDate / total * 100).toFixed(0)}%)\r\n`;
    summary += `Outdated (Not in OpenVSX, but in MS marketplace): ${notInOpen} (${(notInOpen / total * 100).toFixed(0)}%)\r\n`;
    summary += `Outdated (MS marketplace > Open VSX): ${outdated} (${(outdated / total * 100).toFixed(0)}%)\r\n`;
    summary += `Unstable (MS marketplace < Open VSX): ${unstable} (${(unstable / total * 100).toFixed(0)}%)\r\n`;
    summary += `Not in MS marketplace: ${notInMS} (${(notInMS / total * 100).toFixed(0)}%)\r\n`;
    summary += `Failed to publish: ${stat.failed.length} (${(stat.failed.length / total * 100).toFixed(0)}%) \r\n`
    summary += `MS is publisher: ${msPublished} (${(msPublished / total * 100).toFixed(0)}%)\r\n`;
    summary += `\r\n`;
    summary += `Updated in MS marketplace in month-to-date: ${updatedInMTD}\r\n`;
    summary += `Of which updated in Open VSX within 2 days: ${updatedInOpen} (${(updatedInOpen / updatedInMTD * 100).toFixed(0)}%)\r\n`;
    summary += '-------------------\r\n';
    console.log(summary);

    let content = summary;
    if (outdated) {
        if (process.env.VALIDATE_PR !== 'true') {
            process.exitCode = -1;
        }
        content += '\r\n----- Outdated (MS marketplace > Open VSX version) -----\r\n';
        for (const id of sortedKeys(stat.outdated)) {
            const r = stat.outdated[id];
            content += `${id} (installs: ${r.msInstalls}, daysInBetween: ${r.daysInBetween.toFixed(0)}): ${r.msVersion} > ${r.openVersion}\r\n`;
        }
        content += '-------------------\r\n';
    }

    if (notInOpen) {
        if (process.env.VALIDATE_PR !== 'true') {
            process.exitCode = -1;
        }
        content += '\r\n----- Not published to Open VSX, but in MS marketplace -----\r\n';
        for (const id of Object.keys(stat.notInOpen).sort((a, b) => stat.notInOpen[b].msInstalls - stat.notInOpen[a].msInstalls)) {
            const r = stat.notInOpen[id];
            content += `${id} (installs: ${r.msInstalls}): ${r.msVersion}\r\n`;
        }
        content += '-------------------\r\n';
    }

    if (unstable) {
        if (process.env.VALIDATE_PR !== 'true') {
            process.exitCode = -1;
        }
        content += '\r\n----- Unstable (Open VSX > MS marketplace version) -----\r\n';
        for (const id of sortedKeys(stat.unstable)) {
            const r = stat.unstable[id];
            content += `${id} (installs: ${r.msInstalls}, daysInBetween: ${r.daysInBetween.toFixed(0)}): ${r.openVersion} > ${r.msVersion}\r\n`;
        }
        content += '-------------------\r\n';
    }

    if (notInMS) {
        process.exitCode = -1;
        content += '\r\n----- Not published to MS marketplace -----\r\n';
        content += stat.notInMS.join(', ') + '\r\n';
        content += '-------------------\r\n';
    }

    if (stat.failed.length) {
        process.exitCode = -1;
        content += '\r\n----- Failed to publish -----\r\n';
        content += stat.failed.join(', ') + '\r\n';
        content += '-------------------\r\n';
    }

    if (msPublished) {
        content += '\r\n----- MS extensions -----\r\n'
        for (const id of Object.keys(stat.msPublished).sort((a, b) => stat.msPublished[b].msInstalls - stat.msPublished[a].msInstalls)) {
            const r = stat.msPublished[id];
            content += `${id} (installs: ${r.msInstalls})\r\n`;
        }
        content += '-------------------\r\n';
    }

    if (updatedInMTD) {
        content += '\r\n----- Updated in Open VSX within 2 days after in MS marketplace in MTD -----\r\n';
        for (const id of sortedKeys(stat.hitMiss)) {
            const r = stat.hitMiss[id];
            content += `${r.hit ? '+' : '-'} ${id}: installs: ${r.msInstalls}; daysInBetween: ${r.daysInBetween?.toFixed(0)}; MS marketplace: ${r.msVersion}; Open VSX: ${r.openVersion}\r\n`;
        }
        content += '-------------------\r\n';
    }

    if (upToDate) {
        content += '\r\n----- Up-to-date (Open VSX = MS marketplace version) -----\r\n';
        for (const id of Object.keys(stat.upToDate).sort((a, b) => stat.upToDate[b].msInstalls - stat.upToDate[a].msInstalls)) {
            const r = stat.upToDate[id];
            content += `${id} (installs: ${r.msInstalls}, daysInBetween: ${r.daysInBetween.toFixed(0)}): ${r.openVersion}\r\n`;
        }
        content += '-------------------\r\n';
    }

    await fs.promises.writeFile("/tmp/result.log", content, { encoding: 'utf8' });
    console.log('See result output for the detailed report.')
})();