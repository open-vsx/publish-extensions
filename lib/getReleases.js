
// @ts-check
const fetch = require('node-fetch');
const { gte } = require('semver');

exports.findLatestVSIXRelease = async function (/** @type {string} */ repository, /** @type {string} */ version) {
  const [owner, repo] = new URL(repository).pathname.slice(1).split("/");
  console.log(`Fetching ${owner}/${repo} to check for updates...`);
  const token = process.env.GH_PAT;
  if (!token) {
    throw new Error("GitHub personal access token is missing");
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
    if (releases.status === 401) {
      throw new Error("The GitHub personal access token is invalid");
    }
    throw new Error(`Failed to fetch releases: ${releases.status} ${releases.statusText}`);
  }

  const releaseData = await releases.json();

  const latestRelease = releaseData.data.repository.releases.edges.find(r => r.node.isLatest);

  if (latestRelease && latestRelease.node && gte(latestRelease.node.tagName, version)) {
    throw new Error(`The latest release from GitHub (${latestRelease.node.tagName}) is older than the one already in the extensions list ${version}`);
  }

  return latestRelease?.node.releaseAssets.nodes.
    map(a => a.downloadUrl).
    find(d => d.match(/\/releases\/download\/[-._a-zA-Z0-9\/%]*\.vsix/g));
}
