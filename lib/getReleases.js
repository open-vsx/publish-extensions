
// @ts-check
const { lt } = require('semver');
const Octokit = require("octokit").Octokit;

/**
 * 
 * @param {string} repository 
 * @param {string} version 
 * @param {string | undefined} [msVersion]
 * @returns {Promise<string | undefined>}
 */
exports.resolveFromRelease = async function (repository, version, msVersion) {
  const [owner, repo] = new URL(repository).pathname.slice(1).split("/");
  console.log(`Fetching ${owner}/${repo} to check for updates...`);
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN env var is not set");
  }

  const octokit = new Octokit({ auth: token });

  if (msVersion) {
    const specifiedRelease = await octokit.rest.repos.getReleaseByTag({ owner, repo, tag: msVersion });
    if (specifiedRelease.status === 200 && specifiedRelease?.data.assets) {
      return specifiedRelease.data.assets.
        map((asset) => asset.browser_download_url).
        find((downloadURL) => downloadURL.match(/\/releases\/download\/[-._a-zA-Z0-9\/%]*\.vsix/g));
    } else {
      if (specifiedRelease.status !== 200) {
        throw new Error(`Octokit GitHub API error: HTTP ${specifiedRelease.status}`)
      }
      // Specified `msVersion` not found
      return undefined;
    }
  }

  const latestRelease = await octokit.rest.repos.getLatestRelease({ owner, repo });

  if (latestRelease.status !== 200) {
    throw new Error(`Octokit GitHub API error: HTTP ${latestRelease.status}`)
  }

  if (latestRelease?.data.tag_name && version && lt(latestRelease.data.tag_name, version)) {
    throw new Error(`The latest release from GitHub (${latestRelease.data.tag_name}) is older than the one already in the extensions list (${version})`);
  }

  return latestRelease.data.assets.
    map((asset) => asset.browser_download_url).
    find((downloadURL) => downloadURL.match(/\/releases\/download\/[-._a-zA-Z0-9\/%]*\.vsix/g));
}