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
const Octokit = require('octokit').Octokit;
const download = require('download');
const path = require('node:path');
const exec = require('./lib/exec');

const token = process.env.GITHUB_TOKEN;
if (!token) {
  console.error("GITHUB_TOKEN env var is not set, the week-over-week statistic won't be included");
}
const octokit = new Octokit({ auth: token });

/**
 * @param {{ [id: string]: (Partial<import('./types').MSExtensionStat | import('./types').ExtensionStat>) }} s
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
    
    let lastWeekUpToDate;
    try {
        if (token) {
            const weekMilis = 7 * 86_400 * 1000 - 3600; // One hour tolerance
            const previousReports = (await octokit.rest.actions.listArtifactsForRepo({
                owner: 'open-vsx',
                repo: 'publish-extensions',
                per_page: 100
            })).data.artifacts;
            const previousWeekReport = previousReports.find(report => new Date().getTime() - new Date(report.created_at).getTime() > weekMilis);
            const outputFile = '/tmp/report.zip';
            const downloadURL = await octokit.rest.actions.downloadArtifact({
                owner: 'open-vsx',
                repo: 'publish-extensions',
                artifact_id: previousWeekReport.id,
                archive_format: 'zip',
            });

            // @ts-ignore
            fs.appendFileSync(outputFile, Buffer.from(downloadURL.data));
            fs.rmSync('/tmp/lastweek/', { recursive: true, force: true });
            fs.mkdirSync('/tmp/lastweek/');
            try {
                await exec(`unzip ${outputFile} -d /tmp/lastweek/`, {quiet: true});
            } catch {}
            const stat = JSON.parse(await fs.promises.readFile("/tmp/lastweek/stat.json", { encoding: 'utf8' }));

            const upToDate = Object.keys(stat.upToDate).length;
            const unstable = Object.keys(stat.unstable).length;
            const outdated = Object.keys(stat.outdated).length;
            const notInOpen = Object.keys(stat.notInOpen).length;
            const notInMS = stat.notInMS.length;
            const total = upToDate + notInOpen + outdated + unstable + notInMS;

            lastWeekUpToDate = upToDate / total * 100;
        }
    } catch (e) {
        console.error(e);
    }

    /** @type{import('./types').PublishStat}*/
    const stat = JSON.parse(await fs.promises.readFile("/tmp/stat.json", { encoding: 'utf8' }));
    
    const upToDate = Object.keys(stat.upToDate).length;
    const unstable = Object.keys(stat.unstable).length;
    const outdated = Object.keys(stat.outdated).length;
    const notInOpen = Object.keys(stat.notInOpen).length;
    const notInMS = stat.notInMS.length;
    const total = upToDate + notInOpen + outdated + unstable + notInMS;
    const updatedInMTD = Object.keys(stat.hitMiss).length;
    const updatedInOpenIn2Days = new Set(Object.keys(stat.hitMiss).filter(id => {
        const { daysInBetween } = stat.hitMiss[id];
        return typeof daysInBetween === 'number' && 0 <= Math.round(daysInBetween) && Math.round(daysInBetween) <= 2;
    }));
    const updatedInOpenIn2Weeks = new Set(Object.keys(stat.hitMiss).filter(id => {
        const { daysInBetween } = stat.hitMiss[id];
        return typeof daysInBetween === 'number' && 0 <= Math.round(daysInBetween) && Math.round(daysInBetween) <= 14;
    }));
    const updatedInOpenInMonth = new Set(Object.keys(stat.hitMiss).filter(id => {
        const { daysInBetween } = stat.hitMiss[id];
        return typeof daysInBetween === 'number' && 0 <= Math.round(daysInBetween) && Math.round(daysInBetween) <= 30;
    }));
    const msPublished = Object.keys(stat.msPublished).length;

    const totalResolutions = Object.keys(stat.resolutions).length;
    const fromReleaseAsset = Object.keys(stat.resolutions).filter(id => stat.resolutions[id].releaseAsset).length;
    const fromReleaseTag = Object.keys(stat.resolutions).filter(id => stat.resolutions[id].releaseTag).length;
    const fromTag = Object.keys(stat.resolutions).filter(id => stat.resolutions[id].tag).length;
    const fromLatestUnmaintained = Object.keys(stat.resolutions).filter(id => stat.resolutions[id].latest && stat.resolutions[id].msVersion).length;
    const fromLatestNotPublished = Object.keys(stat.resolutions).filter(id => stat.resolutions[id].latest && !stat.resolutions[id].msVersion).length;
    const fromMatchedLatest = Object.keys(stat.resolutions).filter(id => stat.resolutions[id].matchedLatest).length;
    const fromMatched = Object.keys(stat.resolutions).filter(id => stat.resolutions[id].matched).length;
    const totalResolved = fromReleaseAsset + fromReleaseTag + fromTag + fromLatestUnmaintained + fromLatestNotPublished + fromMatchedLatest + fromMatched;

    const upToDateChange = lastWeekUpToDate ? (upToDate / total * 100) - lastWeekUpToDate : undefined; 

    let summary = '----- Summary -----\r\n';
    summary += `Total: ${total}\r\n`;
    summary += `Up-to-date (MS Marketplace == Open VSX): ${upToDate} (${(upToDate / total * 100).toFixed(0)}%) (${upToDateChange !== undefined ? `${upToDateChange ? `${Math.abs(upToDateChange).toFixed(3)}% ` : ''}${upToDateChange > 0 ? 'increase' : upToDateChange === 0 ? 'no change' : 'decrease'} since last week` : "WoW change n/a"})\r\n`;
    summary += `Outdated (Not in OpenVSX, but in MS marketplace): ${notInOpen} (${(notInOpen / total * 100).toFixed(0)}%)\r\n`;
    summary += `Outdated (MS marketplace > Open VSX): ${outdated} (${(outdated / total * 100).toFixed(0)}%)\r\n`;
    summary += `Unstable (MS marketplace < Open VSX): ${unstable} (${(unstable / total * 100).toFixed(0)}%)\r\n`;
    summary += `Not in MS marketplace: ${notInMS} (${(notInMS / total * 100).toFixed(0)}%)\r\n`;
    summary += `Failed to publish: ${stat.failed.length} (${(stat.failed.length / total * 100).toFixed(0)}%) \r\n`
    summary += `MS is publisher: ${msPublished} (${(msPublished / total * 100).toFixed(0)}%)\r\n`;
    summary += `\r\n`;
    summary += `Total resolutions: ${totalResolutions}\r\n`;
    summary += `From release asset: ${fromReleaseAsset} (${(fromReleaseAsset / totalResolutions * 100).toFixed(0)}%)\r\n`;
    summary += `From release tag: ${fromReleaseTag} (${(fromReleaseTag / totalResolutions * 100).toFixed(0)}%)\r\n`;
    summary += `From repo tag: ${fromTag} (${(fromTag / totalResolutions * 100).toFixed(0)}%)\r\n`;
    summary += `From very latest repo commit of unmaintained (last update >= 2 months ago): ${fromLatestUnmaintained} (${(fromLatestUnmaintained / totalResolutions * 100).toFixed(0)}%)\r\n`;
    summary += `From very latest repo commit of not published to MS: ${fromLatestNotPublished} (${(fromLatestNotPublished / totalResolutions * 100).toFixed(0)}%)\r\n`;
    summary += `From very latest repo commit on the last update date: ${fromMatchedLatest} (${(fromMatchedLatest / totalResolutions * 100).toFixed(0)}%)\r\n`;
    summary += `From latest repo commit on the last update date: ${fromMatched} (${(fromMatched / totalResolutions * 100).toFixed(0)}%)\r\n`;
    summary += `Total resolved: ${totalResolved} (${(totalResolved / totalResolutions * 100).toFixed(0)}%)\r\n`;
    summary += `\r\n`;
    summary += `Updated in MS marketplace in month-to-date: ${updatedInMTD}\r\n`;
    summary += `Of which updated in Open VSX within 2 days: ${updatedInOpenIn2Days.size} (${(updatedInOpenIn2Days.size / updatedInMTD * 100).toFixed(0)}%)\r\n`;
    summary += `Of which updated in Open VSX within 2 weeks: ${updatedInOpenIn2Weeks.size} (${(updatedInOpenIn2Weeks.size / updatedInMTD * 100).toFixed(0)}%)\r\n`;
    summary += `Of which updated in Open VSX within a month: ${updatedInOpenInMonth.size} (${(updatedInOpenInMonth.size / updatedInMTD * 100).toFixed(0)}%)\r\n`;
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
            const in2Days = updatedInOpenIn2Days.has(id) ? '+' : '-';
            const in2Weeks = updatedInOpenIn2Weeks.has(id) ? '+' : '-';
            const inMonth = updatedInOpenInMonth.has(id) ? '+' : '-';
            content += `${inMonth}${in2Weeks}${in2Days} ${id}: installs: ${r.msInstalls}; daysInBetween: ${r.daysInBetween?.toFixed(0)}; MS marketplace: ${r.msVersion}; Open VSX: ${r.openVersion}\r\n`;
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

    if (totalResolutions) {
        content += '\r\n----- Resolutions -----\r\n';
        for (const id of sortedKeys(stat.resolutions)) {
            const r = stat.resolutions[id];
            if (r?.releaseAsset) {
                content += `${id} (installs: ${r.msInstalls}): from '${r.releaseAsset}' release asset\r\n`;
            } else if (r?.releaseTag) {
                content += `${id} (installs: ${r.msInstalls}): from '${r.releaseTag}' release tag\r\n`;
            } else if (r?.tag) {
                content += `${id} (installs: ${r.msInstalls}): from '${r.tag}' release repo tag\r\n`;
            } else if (r?.latest) {
                if (r.msVersion) {
                    content += `${id} (installs: ${r.msInstalls}): from '${r.latest}' the very latest repo commit, since it is not actively maintained\r\n`;
                } else {
                    content += `${id} (installs: ${r.msInstalls}): from '${r.latest}' the very latest repo commit, since it is not published to MS marketplace\r\n`;
                }
            } else if (r?.matchedLatest) {
                content += `${id} (installs: ${r.msInstalls}): from '${r.matchedLatest}' from the very latest commit on the last update date\r\n`;
            } else if (r?.matched) {
                content += `${id} (installs: ${r.msInstalls}): from '${r.matched}' from the latest commit on the last update date\r\n`;
            } else {
                content += `${id} (installs: ${r.msInstalls}): unresolved\r\n`;
            }
        }
        content += '-------------------\r\n';
    }

    await fs.promises.writeFile("/tmp/result.log", content, { encoding: 'utf8' });
    console.log('See result output for the detailed report.')
})();