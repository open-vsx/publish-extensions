/********************************************************************************
 * Copyright (c) 2021-2023 Gitpod and others
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * SPDX-License-Identifier: EPL-2.0
 ********************************************************************************/

import fs from "fs";
import humanNumber from "human-number";

import {
    calculatePercentage,
    generateMicrosoftLink,
    generateOpenVsxLink,
    lineBreak,
    positionOf,
    readPublishStatistics,
} from "./lib/helpers";
import { formatter } from "./lib/reportStat";
import type { ExtensionStat, MSExtensionStat } from "./types";

type InputExtensionStat = Partial<MSExtensionStat | ExtensionStat>;
function sortedKeys(s: { [id: string]: InputExtensionStat }) {
    return Object.keys(s).sort((a, b) => {
        const msInstallsA = s[a].msInstalls ?? 0;
        const msInstallsB = s[b].msInstalls ?? 0;

        return msInstallsB - msInstallsA;
    });
}

const stat = await readPublishStatistics();

const getAggregatedInstalls = (category: "upToDate" | "unstable" | "outdated" | "notInOpen") => {
    return Object.keys(stat[category])
        .map((st) => stat[category][st].msInstalls)
        .reduce((previousValue, currentValue) => previousValue + currentValue, 0);
};

const aggregatedInstalls = {
    upToDate: getAggregatedInstalls("upToDate"),
    unstable: getAggregatedInstalls("unstable"),
    outdated: getAggregatedInstalls("outdated"),
    notInOpen: getAggregatedInstalls("notInOpen"),
};

const upToDate = Object.keys(stat.upToDate).length;
const unstable = Object.keys(stat.unstable).length;
const outdated = Object.keys(stat.outdated).length;
const notInOpen = Object.keys(stat.notInOpen).length;
const notInMS = stat.notInMS.length;
const total = upToDate + notInOpen + outdated + unstable + notInMS;
const updatedInMTD = Object.keys(stat.hitMiss).length;
const updatedInOpenIn2Days = new Set(
    Object.keys(stat.hitMiss).filter((id) => {
        const { daysInBetween } = stat.hitMiss[id];
        return typeof daysInBetween === "number" && 0 <= Math.round(daysInBetween) && Math.round(daysInBetween) <= 2;
    }),
);
const updatedInOpenIn2Weeks = new Set(
    Object.keys(stat.hitMiss).filter((id) => {
        const { daysInBetween } = stat.hitMiss[id];
        return typeof daysInBetween === "number" && 0 <= Math.round(daysInBetween) && Math.round(daysInBetween) <= 14;
    }),
);
const updatedInOpenInMonth = new Set(
    Object.keys(stat.hitMiss).filter((id) => {
        const { daysInBetween } = stat.hitMiss[id];
        return typeof daysInBetween === "number" && 0 <= Math.round(daysInBetween) && Math.round(daysInBetween) <= 30;
    }),
);
const msPublished = Object.keys(stat.msPublished).length;
const msPublishedOutdated = Object.keys(stat.outdated).filter((id) => Object.keys(stat.msPublished).includes(id));
const msPublishedUnstable = Object.keys(stat.unstable).filter((id) => Object.keys(stat.msPublished).includes(id));

const totalResolutions = Object.keys(stat.resolutions).length;
const fromReleaseAsset = Object.keys(stat.resolutions).filter((id) => stat.resolutions[id].releaseAsset).length;
const fromReleaseTag = Object.keys(stat.resolutions).filter((id) => stat.resolutions[id].releaseTag).length;
const fromTag = Object.keys(stat.resolutions).filter((id) => stat.resolutions[id].tag).length;
const fromLatestUnmaintained = Object.keys(stat.resolutions).filter(
    (id) => stat.resolutions[id].latest && stat.resolutions[id].msVersion,
).length;
const fromLatestNotPublished = Object.keys(stat.resolutions).filter(
    (id) => stat.resolutions[id].latest && !stat.resolutions[id].msVersion,
).length;
const fromMatchedLatest = Object.keys(stat.resolutions).filter((id) => stat.resolutions[id].matchedLatest).length;
const fromMatched = Object.keys(stat.resolutions).filter((id) => stat.resolutions[id].matched).length;
const totalResolved =
    fromReleaseAsset +
    fromReleaseTag +
    fromTag +
    fromLatestUnmaintained +
    fromLatestNotPublished +
    fromMatchedLatest +
    fromMatched;

const weightedPercentage =
    aggregatedInstalls.upToDate /
    (aggregatedInstalls.notInOpen +
        aggregatedInstalls.upToDate +
        aggregatedInstalls.outdated +
        aggregatedInstalls.unstable);

let summary: string[] = ["# Summary"];

if (!process.env.EXTENSIONS) {
    summary.push(
        `Total: ${total}`,
        `Up-to-date (MS Marketplace == Open VSX): ${upToDate} (${calculatePercentage(upToDate, total)})`,
        `Weighted publish percentage: ${(weightedPercentage * 100).toFixed(0)}%`,
        `Outdated (Not in Open VSX, but in MS marketplace): ${notInOpen} (${calculatePercentage(notInOpen, total)})`,
        `Outdated (MS marketplace > Open VSX): ${outdated} (${calculatePercentage(outdated, total)})`,
        `Unstable (MS marketplace < Open VSX): ${unstable} (${calculatePercentage(unstable, total)})`,
        `Not in MS marketplace: ${notInMS} (${calculatePercentage(notInMS, total)})`,
        `Failed to publish: ${stat.failed.length} (${calculatePercentage(stat.failed.length, total)})`,
        "",
        "Microsoft:",
        `Total: ${msPublished} (${calculatePercentage(msPublished, total)})`,
        `Outdated: ${msPublishedOutdated.length}`,
        `Unstable: ${msPublishedUnstable.length}`,
        "",
        `Total resolutions: ${totalResolutions}`,
        `From release asset: ${fromReleaseAsset} (${calculatePercentage(fromReleaseAsset, totalResolutions)})`,
        `From release tag: ${fromReleaseTag} (${calculatePercentage(fromReleaseTag, totalResolutions)})`,
        `From repo tag: ${fromTag} (${calculatePercentage(fromTag, totalResolutions)})`,
        `From very latest repo commit of unmaintained (last update >= 2 months ago): ${fromLatestUnmaintained} (${calculatePercentage(fromLatestUnmaintained, totalResolutions)})`,
        `From very latest repo commit of not published to MS: ${fromLatestNotPublished} (${calculatePercentage(fromLatestNotPublished, totalResolutions)})`,
        `From very latest repo commit on the last update date: ${fromMatchedLatest} (${calculatePercentage(fromMatchedLatest, totalResolutions)})`,
        `From latest repo commit on the last update date: ${fromMatched} (${calculatePercentage(fromMatched, totalResolutions)})`,
        `Total resolved: ${totalResolved} (${calculatePercentage(totalResolved, totalResolutions)})`,
        "",
        `Updated in MS marketplace in month-to-date: ${updatedInMTD}`,
        `Of which updated in Open VSX within 2 days: ${updatedInOpenIn2Days.size} (${calculatePercentage(updatedInOpenIn2Days.size, updatedInMTD)})`,
        `Of which updated in Open VSX within 2 weeks: ${updatedInOpenIn2Weeks.size} (${calculatePercentage(updatedInOpenIn2Weeks.size, updatedInMTD)})`,
        `Of which updated in Open VSX within a month: ${updatedInOpenInMonth.size} (${calculatePercentage(updatedInOpenInMonth.size, updatedInMTD)})`,
    );
} else {
    if (total === 0) {
        summary.push("No extensions were processed");
    } else {
        summary.push(
            `Up-to-date (MS Marketplace == Open VSX): ${upToDate} (${calculatePercentage(upToDate, total)})`,
            `Failed to publish: ${stat.failed.length} (${calculatePercentage(stat.failed.length, total)})`,
            `Outdated: ${msPublishedOutdated.length}`,
            `Unstable: ${msPublishedUnstable.length}`,
        );
    }
}

console.log(summary.join(lineBreak));
summary.push("", "---", "");

let content: string[] = summary;

if (outdated) {
    const keys = sortedKeys(stat.outdated);
    content.push("## Outdated (MS marketplace > Open VSX version)");
    for (const id of keys) {
        const r = stat.outdated[id];
        content.push(
            `${positionOf(id, keys)} ${generateMicrosoftLink(id)} (installs: ${humanNumber(r.msInstalls, formatter)}, daysInBetween: ${r.daysInBetween.toFixed(0)}): ${r.msVersion} > ${r.openVersion}`,
        );
    }
}

if (notInOpen) {
    const keys = Object.keys(stat.notInOpen).sort(
        (a, b) => stat.notInOpen[b].msInstalls - stat.notInOpen[a].msInstalls,
    );
    content.push("", "## Not published to Open VSX, but in MS marketplace");
    for (const id of keys) {
        const r = stat.notInOpen[id];
        content.push(
            `${positionOf(id, keys)} ${generateMicrosoftLink(id)} (installs: ${humanNumber(r.msInstalls, formatter)}): ${r.msVersion}`,
        );
    }
}

if (unstable) {
    const keys = sortedKeys(stat.unstable);
    content.push("", "## Unstable (Open VSX > MS marketplace version)");
    for (const id of keys) {
        const r = stat.unstable[id];
        content.push(
            `${positionOf(id, keys)} ${generateMicrosoftLink(id)} (installs: ${humanNumber(r.msInstalls, formatter)}, daysInBetween: ${r.daysInBetween.toFixed(0)}): ${r.openVersion} > ${r.msVersion}`,
        );
    }
}

if (notInMS) {
    content.push("", "## Not published to MS marketplace");
    content.push(...stat.notInMS.map((ext) => `- ${generateOpenVsxLink(ext)}`));
}

if (stat.failed.length) {
    content.push("", "## Failed to publish");
    content.push(...stat.failed.map((ext) => `- ${generateMicrosoftLink(ext)}`));
}

if ((unstable || stat.failed.length || outdated) && process.env.VALIDATE_PR === "true") {
    // Fail the validating job if there are failing extensions
    process.exitCode = 1;
}

/**
 * A threshold above which we will be alerted about a big extension breaking
 */
const threshold = 10_000_000;
const existsFailingExtensionAboveThreshold = Object.keys(stat.outdated).some((id) => {
    const extension = stat.resolutions[id];
    if (!extension?.msInstalls) {
        return false;
    }

    const aboveThreshold = extension.msInstalls > threshold;
    if (aboveThreshold) {
        console.log(`Extension ${id} is outdated and has ${humanNumber(extension.msInstalls)} installs`);
    }

    return aboveThreshold;
});

// This should indicate a big extension breaking
if (existsFailingExtensionAboveThreshold) {
    console.error(
        `There are outdated extensions above the threshold of ${humanNumber(threshold)} installs. See above for the list.`,
    );
    process.exitCode = 1;
}

if (msPublished) {
    content.push("## MS extensions");
    const publishedKeys = Object.keys(stat.msPublished).sort(
        (a, b) => stat.msPublished[b].msInstalls - stat.msPublished[a].msInstalls,
    );
    const outdatedKeys = msPublishedOutdated.sort(
        (a, b) => stat.msPublished[b].msInstalls - stat.msPublished[a].msInstalls,
    );
    const unstableKeys = msPublishedUnstable.sort(
        (a, b) => stat.msPublished[b].msInstalls - stat.msPublished[a].msInstalls,
    );

    publishedKeys.forEach((id) => {
        const r = stat.msPublished[id];
        content.push(
            `${positionOf(id, publishedKeys)} ${generateMicrosoftLink(id)} (installs: ${humanNumber(r.msInstalls, formatter)})`,
        );
    });

    content.push("## MS Outdated");
    outdatedKeys.forEach((id) => {
        const r = stat.msPublished[id];
        content.push(
            `${positionOf(id, outdatedKeys)} ${generateMicrosoftLink(id)} (installs: ${humanNumber(r.msInstalls, formatter)})`,
        );
    });

    content.push("## MS Unstable");
    unstableKeys.forEach((id) => {
        const r = stat.msPublished[id];
        content.push(
            `${positionOf(id, unstableKeys)} ${generateMicrosoftLink(id)} (installs: ${humanNumber(r.msInstalls, formatter)})`,
        );
    });
}

if (updatedInMTD) {
    content.push("## Updated in Open VSX within 2 days after in MS marketplace in MTD");
    const keys = sortedKeys(stat.hitMiss);
    keys.forEach((id) => {
        const r = stat.hitMiss[id];
        const in2Days = updatedInOpenIn2Days.has(id) ? "+" : "-";
        const in2Weeks = updatedInOpenIn2Weeks.has(id) ? "+" : "-";
        const inMonth = updatedInOpenInMonth.has(id) ? "+" : "-";
        content.push(
            `${positionOf(id, keys)} ${inMonth}${in2Weeks}${in2Days} ${generateMicrosoftLink(id)}: installs: ${humanNumber(r.msInstalls, formatter)}; daysInBetween: ${r.daysInBetween?.toFixed(0)}; MS marketplace: ${r.msVersion}; Open VSX: ${r.openVersion}`,
        );
    });
}

if (upToDate) {
    content.push("## Up-to-date (Open VSX = MS marketplace version)");
    const keys = Object.keys(stat.upToDate).sort((a, b) => stat.upToDate[b].msInstalls - stat.upToDate[a].msInstalls);
    keys.forEach((id) => {
        const r = stat.upToDate[id];
        content.push(
            `${positionOf(id, keys)} ${generateMicrosoftLink(id)} (installs: ${humanNumber(r.msInstalls, formatter)}, daysInBetween: ${r.daysInBetween.toFixed(0)}): ${r.openVersion}`,
        );
    });
}

if (totalResolutions) {
    content.push("## Resolutions");
    const keys = sortedKeys(stat.resolutions);
    keys.forEach((id) => {
        const extension = stat.resolutions[id];
        const base =
            extension?.latest && !extension.msVersion
                ? `${positionOf(id, keys)} ${generateOpenVsxLink(id)} from '`
                : `${positionOf(id, keys)} ${generateMicrosoftLink(id)} (installs: ${humanNumber(extension.msInstalls!, formatter)}) from`;
        if (extension?.releaseAsset) {
            content.push(`${base} '${extension.releaseAsset}' release asset`);
        } else if (extension?.releaseTag) {
            content.push(`${base} '${extension.releaseTag}' release tag`);
        } else if (extension?.tag) {
            content.push(`${base} the '${extension.tag}' release tag`);
        } else if (extension?.latest) {
            if (extension.msVersion) {
                content.push(
                    `${base} '${extension.latest}' - the very latest repo commit, since it is not actively maintained`,
                );
            } else {
                content.push(
                    `${base} '${extension.latest}' - the very latest repo commit, since it is not published to MS marketplace`,
                );
            }
        } else if (extension?.matchedLatest) {
            content.push(`${base} '${extension.matchedLatest}' - the very latest commit on the last update date`);
        } else if (extension?.matched) {
            content.push(`${base} '${extension.matched}' - the latest commit on the last update date`);
        } else {
            content.push(`${base} unresolved`);
        }
    });
}

await fs.promises.writeFile("/tmp/result.md", content.join(lineBreak), { encoding: "utf8" });
console.log("See result output for the detailed report.");
