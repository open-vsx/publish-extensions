/********************************************************************************
 * Copyright (c) 2021-2023 Gitpod and others
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
const { formatter } = require('./lib/reportStat');
const humanNumber = require('human-number');
const unzipper = require('unzipper');
const { registryHost } = require('./lib/constants');

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

/**
 * @param {any} item
 * @param {string | any[]} array
 * @returns {string} the position of the item in the array with a `.` appended onto it.
 */
function positionOf(item, array) {
    return `${array.indexOf(item) + 1}.`;
}

const generateMicrosoftLink = (/** @type {string} */ id) => `[${id}](https://marketplace.visualstudio.com/items?itemName=${id})`;
const generateOpenVsxLink = (/** @type {string} */ id) => `[${id}](https://${registryHost}/extension/${id.split(".")[0]}/${id.split(".")[1]})`;

(async () => {
    /** @type{import('./types').PublishStat}*/
    const stat = JSON.parse(await fs.promises.readFile("/tmp/stat.json", { encoding: 'utf8' }));

    /**
     *
     * @param {'upToDate' | 'unstable' | 'outdated' | 'notInOpen'} category
     * @returns
     */
    const getAggregatedInstalls = (category) => {
        return Object.keys(stat[category]).map((st) => stat[category][st].msInstalls).reduce(
            (previousValue, currentValue) => previousValue + currentValue,
            0
        );
    }

    const aggregatedInstalls = {
        upToDate: getAggregatedInstalls('upToDate'),
        unstable: getAggregatedInstalls('unstable'),
        outdated: getAggregatedInstalls('outdated'),
        notInOpen: getAggregatedInstalls('notInOpen')
    }

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
    const msPublishedOutdated = Object.keys(stat.outdated).filter(id => Object.keys(stat.msPublished).includes(id));
    const msPublishedUnstable = Object.keys(stat.unstable).filter(id => Object.keys(stat.msPublished).includes(id));

    const totalResolutions = Object.keys(stat.resolutions).length;
    const fromReleaseAsset = Object.keys(stat.resolutions).filter(id => stat.resolutions[id].releaseAsset).length;
    const fromReleaseTag = Object.keys(stat.resolutions).filter(id => stat.resolutions[id].releaseTag).length;
    const fromTag = Object.keys(stat.resolutions).filter(id => stat.resolutions[id].tag).length;
    const fromLatestUnmaintained = Object.keys(stat.resolutions).filter(id => stat.resolutions[id].latest && stat.resolutions[id].msVersion).length;
    const fromLatestNotPublished = Object.keys(stat.resolutions).filter(id => stat.resolutions[id].latest && !stat.resolutions[id].msVersion).length;
    const fromMatchedLatest = Object.keys(stat.resolutions).filter(id => stat.resolutions[id].matchedLatest).length;
    const fromMatched = Object.keys(stat.resolutions).filter(id => stat.resolutions[id].matched).length;
    const totalResolved = fromReleaseAsset + fromReleaseTag + fromTag + fromLatestUnmaintained + fromLatestNotPublished + fromMatchedLatest + fromMatched;

    const weightedPercentage = (aggregatedInstalls.upToDate / (aggregatedInstalls.notInOpen + aggregatedInstalls.upToDate + aggregatedInstalls.outdated + aggregatedInstalls.unstable));

    let summary = '# Summary\r\n\n';

    if (!process.env.EXTENSIONS) {
        summary += `Total: ${total}\r\n`;
        summary += `Up-to-date (MS Marketplace == Open VSX): ${upToDate} (${(upToDate / total * 100).toFixed(0)}%)\r\n`;
        summary += `Weighted publish percentage: ${(weightedPercentage * 100).toFixed(0)}%\r\n`
        summary += `Outdated (Not in Open VSX, but in MS marketplace): ${notInOpen} (${(notInOpen / total * 100).toFixed(0)}%)\r\n`;
        summary += `Outdated (MS marketplace > Open VSX): ${outdated} (${(outdated / total * 100).toFixed(0)}%)\r\n`;
        summary += `Unstable (MS marketplace < Open VSX): ${unstable} (${(unstable / total * 100).toFixed(0)}%)\r\n`;
        summary += `Not in MS marketplace: ${notInMS} (${(notInMS / total * 100).toFixed(0)}%)\r\n`;
        summary += `Failed to publish: ${stat.failed.length} (${(stat.failed.length / total * 100).toFixed(0)}%) \r\n`;
        summary += `\r\n\n`;
        summary += `Microsoft:\r\n`;
        summary += `Total: ${msPublished} (${(msPublished / total * 100).toFixed(0)}%)\r\n`;
        summary += `Outdated: ${msPublishedOutdated.length}\r\n`;
        summary += `Unstable: ${msPublishedUnstable.length}\r\n`;
        summary += `\r\n\n`;
        summary += `Total resolutions: ${totalResolutions}\r\n`;
        summary += `From release asset: ${fromReleaseAsset} (${(fromReleaseAsset / totalResolutions * 100).toFixed(0)}%)\r\n`;
        summary += `From release tag: ${fromReleaseTag} (${(fromReleaseTag / totalResolutions * 100).toFixed(0)}%)\r\n`;
        summary += `From repo tag: ${fromTag} (${(fromTag / totalResolutions * 100).toFixed(0)}%)\r\n`;
        summary += `From very latest repo commit of unmaintained (last update >= 2 months ago): ${fromLatestUnmaintained} (${(fromLatestUnmaintained / totalResolutions * 100).toFixed(0)}%)\r\n`;
        summary += `From very latest repo commit of not published to MS: ${fromLatestNotPublished} (${(fromLatestNotPublished / totalResolutions * 100).toFixed(0)}%)\r\n`;
        summary += `From very latest repo commit on the last update date: ${fromMatchedLatest} (${(fromMatchedLatest / totalResolutions * 100).toFixed(0)}%)\r\n`;
        summary += `From latest repo commit on the last update date: ${fromMatched} (${(fromMatched / totalResolutions * 100).toFixed(0)}%)\r\n`;
        summary += `Total resolved: ${totalResolved} (${(totalResolved / totalResolutions * 100).toFixed(0)}%)\r\n`;
        summary += `\r\n\n`;
        summary += `Updated in MS marketplace in month-to-date: ${updatedInMTD}\r\n`;
        summary += `Of which updated in Open VSX within 2 days: ${updatedInOpenIn2Days.size} (${(updatedInOpenIn2Days.size / updatedInMTD * 100).toFixed(0)}%)\r\n`;
        summary += `Of which updated in Open VSX within 2 weeks: ${updatedInOpenIn2Weeks.size} (${(updatedInOpenIn2Weeks.size / updatedInMTD * 100).toFixed(0)}%)\r\n`;
        summary += `Of which updated in Open VSX within a month: ${updatedInOpenInMonth.size} (${(updatedInOpenInMonth.size / updatedInMTD * 100).toFixed(0)}%)\r\n`;
    } else {
        if (total === 0) {
            summary += 'No extensions were processed\r\n';
        } else {
            summary += `Up-to-date (MS Marketplace == Open VSX): ${upToDate} (${(upToDate / total * 100).toFixed(0)}%)\r\n`;
            summary += `Failed to publish: ${stat.failed.length} (${(stat.failed.length / total * 100).toFixed(0)}%)\r\n`;
            summary += `Outdated: ${msPublishedOutdated.length}\r\n`;
            summary += `Unstable: ${msPublishedUnstable.length}\r\n`;
        }
    }

    console.log(summary);
    summary += `\r\n\n`;
    summary += '---'
    summary += `\r\n\n`;

    let content = summary;
    if (outdated) {
        const keys = sortedKeys(stat.outdated);
        content += '\r\n## Outdated (MS marketplace > Open VSX version)\r\n';
        for (const id of keys) {
            const r = stat.outdated[id];
            content += `${positionOf(id, keys)} ${generateMicrosoftLink(id)} (installs: ${humanNumber(r.msInstalls, formatter)}, daysInBetween: ${r.daysInBetween.toFixed(0)}): ${r.msVersion} > ${r.openVersion}\r\n`;
        }
    }

    if (notInOpen) {
        const keys = Object.keys(stat.notInOpen).sort((a, b) => stat.notInOpen[b].msInstalls - stat.notInOpen[a].msInstalls);
        content += '\r\n## Not published to Open VSX, but in MS marketplace\r\n';
        for (const id of keys) {
            const r = stat.notInOpen[id];
            content += `${positionOf(id, keys)} ${generateMicrosoftLink(id)} (installs: ${humanNumber(r.msInstalls, formatter)}): ${r.msVersion}\r\n`;
        }
    }

    if (unstable) {
        const keys = sortedKeys(stat.unstable);
        content += '\r\n## Unstable (Open VSX > MS marketplace version)\r\n';
        for (const id of keys) {
            const r = stat.unstable[id];
            content += `${positionOf(id, keys)} ${generateMicrosoftLink(id)} (installs: ${humanNumber(r.msInstalls, formatter)}, daysInBetween: ${r.daysInBetween.toFixed(0)}): ${r.openVersion} > ${r.msVersion}\r\n`;
        }
    }

    if (notInMS) {
        content += '\r\n## Not published to MS marketplace\r\n';
        content += stat.notInMS.map(ext => `- ${generateOpenVsxLink(ext)}`).join('\r\n');
        content += '\r\n';
    }

    if (stat.failed.length) {
        content += '\r\n## Failed to publish\r\n';
        content += stat.failed.map(ext => `- ${generateMicrosoftLink(ext)}`).join('\r\n');
        content += '\r\n';
    }

    if ((unstable || stat.failed.length || outdated) && process.env.VALIDATE_PR === 'true') {
        // Fail the validating job if there are failing extensions
        process.exitCode = -1;
    }

    /**
     * A threshold above which we will be alerted about a big extension breaking
     */
    const threshold = 10_000_000;
    const existsFailingExtensionAboveThreshold = Object.keys(stat.outdated).some(id => {
        const extension = stat.resolutions[id];
        if (!extension?.msInstalls) {
            return false;
        }
        console.log(`Extension ${id} is outdated and has ${humanNumber(extension.msInstalls)} installs`)
        return extension.msInstalls > threshold;
    });

    // This should indicate a big extension breaking
    if (existsFailingExtensionAboveThreshold) {
        console.error(`There are outdated extensions above the threshold of ${humanNumber(threshold)} installs. See above for the list.`);
        process.exitCode = -1;
    }

    if (msPublished) {
        const publishedKeys = Object.keys(stat.msPublished).sort((a, b) => stat.msPublished[b].msInstalls - stat.msPublished[a].msInstalls);
        const outdatedKeys = msPublishedOutdated.sort((a, b) => stat.msPublished[b].msInstalls - stat.msPublished[a].msInstalls);
        const unstableKeys = msPublishedUnstable.sort((a, b) => stat.msPublished[b].msInstalls - stat.msPublished[a].msInstalls);

        content += '\r\n## MS extensions\r\n';

        for (const id of publishedKeys) {
            const r = stat.msPublished[id];
            content += `${positionOf(id, publishedKeys)} ${generateMicrosoftLink(id)} (installs: ${humanNumber(r.msInstalls, formatter)})\r\n`;
        }

        content += '\r\n## MS Outdated\r\n'

        for (const id of outdatedKeys) {
            const r = stat.msPublished[id];
            content += `${positionOf(id, outdatedKeys)} ${generateMicrosoftLink(id)} (installs: ${humanNumber(r.msInstalls, formatter)})\r\n`;
        }

        content += '\r\n## MS Unstable\r\n'

        for (const id of unstableKeys) {
            const r = stat.msPublished[id];
            content += `${positionOf(id, unstableKeys)} ${generateMicrosoftLink(id)} (installs: ${humanNumber(r.msInstalls, formatter)})\r\n`;
        }
    }

    if (updatedInMTD) {
        content += '\r\n## Updated in Open VSX within 2 days after in MS marketplace in MTD\r\n';
        const keys = sortedKeys(stat.hitMiss);
        for (const id of keys) {
            const r = stat.hitMiss[id];
            const in2Days = updatedInOpenIn2Days.has(id) ? '+' : '-';
            const in2Weeks = updatedInOpenIn2Weeks.has(id) ? '+' : '-';
            const inMonth = updatedInOpenInMonth.has(id) ? '+' : '-';
            content += `${positionOf(id, keys)} ${inMonth}${in2Weeks}${in2Days} ${generateMicrosoftLink(id)}: installs: ${humanNumber(r.msInstalls, formatter)}; daysInBetween: ${r.daysInBetween?.toFixed(0)}; MS marketplace: ${r.msVersion}; Open VSX: ${r.openVersion}\r\n`;
        }
        content += '\r\n';
    }

    if (upToDate) {
        content += '\r\n## Up-to-date (Open VSX = MS marketplace version)\r\n';
        const keys = Object.keys(stat.upToDate).sort((a, b) => stat.upToDate[b].msInstalls - stat.upToDate[a].msInstalls);
        for (const id of keys) {
            const r = stat.upToDate[id];
            content += `${positionOf(id, keys)} ${generateMicrosoftLink(id)} (installs: ${humanNumber(r.msInstalls, formatter)}, daysInBetween: ${r.daysInBetween.toFixed(0)}): ${r.openVersion}\r\n`;
        }
        content += '\r\n';
    }

    if (totalResolutions) {
        content += '\r\n## Resolutions\r\n';
        const keys = sortedKeys(stat.resolutions);
        for (const id of keys) {
            const r = stat.resolutions[id];
            const base = r?.latest && !r.msVersion ? `${positionOf(id, keys)} ${generateOpenVsxLink(id)} from '` : `${positionOf(id, keys)} ${generateMicrosoftLink(id)} (installs: ${humanNumber(r.msInstalls, formatter)}) from`;
            if (r?.releaseAsset) {
                content += `${base} '${r.releaseAsset}' release asset\r\n`;
            } else if (r?.releaseTag) {
                content += `${base} '${r.releaseTag}' release tag\r\n`;
            } else if (r?.tag) {
                content += `${base} the '${r.tag}' release tag\r\n`;
            } else if (r?.latest) {
                if (r.msVersion) {
                    content += `${base} '${r.latest}' - the very latest repo commit, since it is not actively maintained\r\n`;
                } else {
                    content += `${base} '${r.latest}' - the very latest repo commit, since it is not published to MS marketplace\r\n`;
                }
            } else if (r?.matchedLatest) {
                content += `${base} '${r.matchedLatest}' - the very latest commit on the last update date\r\n`;
            } else if (r?.matched) {
                content += `${base} '${r.matched}' - the latest commit on the last update date\r\n`;
            } else {
                content += `${base} unresolved\r\n`;
            }
        }
    }

    await fs.promises.writeFile("/tmp/result.md", content, { encoding: 'utf8' });
    const metadata = {
        weightedPercentage
    };
    await fs.promises.writeFile('/tmp/meta.json', JSON.stringify(metadata), { encoding: 'utf8' });
    console.log('See result output for the detailed report.');
})();