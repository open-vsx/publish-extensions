
// @ts-check
const fetch = require('node-fetch');
const { lt } = require('semver');

class GitHubAPIError extends Error {
  /**
   * @param {string} message
   * @param {any} [cause]
   */
  constructor(message, cause) {
    super(message);
    this.cause = cause;
    this.name = 'GitHub GraphQL Error';
  }
}

exports.findLatestVSIXRelease = async function (/** @type {string} */ repository, /** @type {string} */ version, /** @type {string | undefined} */ msVersion,) {
  const [owner, repo] = new URL(repository).pathname.slice(1).split("/");
  console.log(`Fetching ${owner}/${repo} to check for updates...`);
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GitHub personal access token is missing");
  }

  if (msVersion) {
    const release = await fetch("https://api.github.com/graphql", {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        query: `query GetVSIXFromRelease {
          repository(name: "${repo}", owner: "${owner}") {
            release(tagName: "${msVersion}") {
              id
              tagName
              releaseAssets(first: 20) {
                edges {
                  node {
                    downloadUrl
                  }
                }
              }
            }
          }
        }` }),
    });
    if (!release.ok) {
      const errorMessage = await release.json();
      throw new GitHubAPIError(`${errorMessage.message} (HTTP ${release.status})`);
    }

    const releaseData = await release.json();

    if (releaseData?.data.repository?.release) {
    return releaseData?.data.repository?.release.releaseAssets.edges.
      map((/** @type {{ node: {downloadUrl: any;} }} */ a) => a.node.downloadUrl).
      find((/** @type {string} */ d) => d.match(/\/releases\/download\/[-._a-zA-Z0-9\/%]*\.vsix/g));
    } else {
      throw new Error("Specified release not found");
    }
  }

  const releases = await fetch("https://api.github.com/graphql", {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      query: `query GetLatestRelease {
      repository(name: "${repo}", owner: "${owner}") {
        releases(first: 20, orderBy: {field: CREATED_AT, direction: DESC}) {
          edges {
            node {
              isLatest
              url
              isPrerelease
              tagName
              releaseAssets(first: 10) {
                nodes {
                  downloadUrl
                }
              }
            }
          }
        }
      }
    }` }),
  });

  if (!releases.ok) {
    const errorMessage = await releases.json();
    throw new GitHubAPIError(`${errorMessage.message} (HTTP ${releases.status})`);
  }

  const releaseData = await releases.json();

  const latestRelease = releaseData.data.repository.releases.edges.find((/** @type {{ node: { isLatest: any; }; }} */ r) => r.node.isLatest);

  if (latestRelease?.node?.tagName && version && lt(latestRelease.node.tagName, version)) {
    throw new Error(`The latest release from GitHub (${latestRelease.node.tagName}) is older than the one already in the extensions list (${version})`);
  }

  return latestRelease?.node.releaseAssets.nodes.
    map((/** @type {{ downloadUrl: any; }} */ a) => a.downloadUrl).
    find((/** @type {string} */ d) => d.match(/\/releases\/download\/[-._a-zA-Z0-9\/%]*\.vsix/g));
}