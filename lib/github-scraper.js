
// @ts-check
const fetch = require('node-fetch');

exports.findLatestVSIXRelease = async function (repository) {
  const [owner, repo] = new URL(repository).pathname.slice(1).split("/");
  console.log(`Scraping ${owner}/${repo} to check for updates...`);
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
        releases(first: 5, orderBy: {field: CREATED_AT, direction: DESC}) {
          edges {
            node {
              isLatest
              url
              isPrerelease
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
  })

  const releaseData = await releases.json();
  const latestRelease = releaseData.data.repository.releases.edges.find(r => r.node.isLatest);
  return latestRelease?.node.releaseAssets.nodes.
    map(a => a.downloadUrl).
    find(d => d.match(/\/releases\/download\/[-._a-zA-Z0-9\/%]*\.vsix/g));
}
