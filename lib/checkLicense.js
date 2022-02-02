// @ts-check

const checkLicense = require("osi-license-checker");
const fs = require('fs');
const octokit = require('octokit');

/**
 * Check if the extension has an OSI-approved open-source license
 * @param {URL} url
 * @param {string} owner
 * @param {string} repo
 * @param {octokit.Octokit} octokit a preauthenthicated octokit client
 * @param {string} packagePath
 */
exports.checkLicense = async function(url, owner, repo, octokit, packagePath) {
  try {
    const manifest = JSON.parse(
      await fs.promises.readFile(packagePath, "utf-8")
    );
    const license = manifest.license;
    if (!license) {
      if (!checkLicense.checkShorthand(license)) {
        console.error(`Not an OSS license: ${license}`);
        return false;
      }

      if (url.hostname !== "github.com") {
        console.error("Can' check license on non-github repositories ");
        return false;
      }

      const ghLicenseResponse = (
        await octokit.rest.licenses.getForRepo({ owner, repo })
      ).data.license;
      if (!checkLicense.checkShorthand(ghLicenseResponse.spdx_id)) {
        console.error(
          `Not an OSS license: ${ghLicenseResponse.name} (${ghLicenseResponse.spdx_id})`
        );
        return false;
      }
      return true;
    }
  } catch (e) {
    console.error("Can't get license", e);
    return false;
  }
}
