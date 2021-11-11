
// @ts-check
const path = require('path');
const Octokit = require('octokit').Octokit;
const readVSIXPackage = require('vsce/out/zip').readVSIXPackage;
const download = require('download');

/**
 * 
 * @param {Readonly<import('../types').Extension>} extension
 * @param {{version: string, lastUpdated: Date} | undefined} [ms]
 * @returns {Promise<import('../types').ResolvedExtension | undefined>}
 */
exports.resolveExtension = async function ({ id, repository, location }, ms) {
  // TODO(ak) support gitlab
  const repositoryUrl = new URL(repository);
  if (repositoryUrl.hostname !== 'github.com') {
    return undefined;
  }
  const [owner, repo] = repositoryUrl.pathname.slice(1).split("/");

  const packagePath = [location, 'package.json'].filter(p => !!p).join('/');
  /**
   * @param {string} ref 
   * @returns {Promise<string | undefined>}
   */
  async function resolveVersion(ref) {
    try {
      const fileResponse = await octokit.rest.repos.getContent({
        owner, repo, ref,
        path: packagePath, mediaType: { format: "raw", }
      });
      if (!(typeof fileResponse.data === 'string')) {
        return undefined;
      }
      const manifest = JSON.parse(fileResponse.data);
      if (`${manifest.publisher}.${manifest.name}`.toLowerCase() !== id.toLowerCase()) {
        return undefined;
      }
      return manifest.version;
    } catch {
      return undefined;
    }
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN env var is not set");
  }
  const octokit = new Octokit({ auth: token });

  if (ms) {
    // check latest release
    try {
      const releaseReponse = await octokit.rest.repos.getLatestRelease({ owner, repo });
      const release = releaseReponse.data;

      const link = release.assets.
        map((asset) => asset.browser_download_url).
        find((downloadURL) => downloadURL.match(/\/releases\/download\/[-._a-zA-Z0-9\/%]*\.vsix/g));

      if (link) {
        const file = '/tmp/download/extension.vsix';
        await download(link, path.dirname(file), { filename: path.basename(file) });
        const manifest = (await readVSIXPackage(file)).manifest;
        if (manifest.version === ms.version && `${manifest.publisher}.${manifest.name}`.toLowerCase() === id.toLowerCase()) {
          return { version: ms.version, release: { link, file } };
        }
      }

      const version = await resolveVersion(release.tag_name)
      if (version && ms.version.includes(version)) {
        return { version: ms.version, releaseTag: release.tag_name };
      }
    } catch { }

    // tags
    const tagsReponse = await octokit.rest.repos.listTags({ owner, repo, per_page: 3 });
    for (const tag of tagsReponse.data) {
      const version = await resolveVersion(tag.name)
      if (version && ms.version.includes(version)) {
        return { version: ms.version, tag: tag.name };
      }
    }
  }

  // if latest commit is too old like 3 months old then we just use last commit
  const latestCommitResponse = await octokit.rest.repos.listCommits({ owner, repo, per_page: 1 });
  const latestCommit = latestCommitResponse.data[0];
  const latestRef = latestCommit?.sha;

  if (!ms) {
    if (!latestRef) {
      return undefined;
    }
    const version = await resolveVersion(latestRef);
    if (!version) {
      return undefined;
    }
    return { version, latest: latestRef };
  }

  if (latestRef) {
    const longTimeAgo = new Date();
    longTimeAgo.setMonth(longTimeAgo.getMonth() - 2);
    const lastUpdated = new Date(latestCommit.commit.committer.date || ms.lastUpdated);
    if (longTimeAgo.getTime() > lastUpdated.getTime()) {
      const version = await resolveVersion(latestRef);
      if (version) {
        return { version, latest: latestRef };
      }
    }
  }

  // match commit around last updated date
  const until = new Date(ms.lastUpdated.getTime() + 12 * (60 * 60 * 1000));
  until.setUTCHours(23, 59, 59, 999);
  const commitsResponse = await octokit.rest.repos.listCommits({
    owner, repo,
    until: until.toISOString()
  });
  let latestMatched;
  // otherwise look for matchig
  for (const [index, commit] of commitsResponse.data.entries()) {
    const ref = commit.sha;
    const version = await resolveVersion(ref);
    if (index === 0 && version) {
      latestMatched = { version, matchedLatest: ref };
      // if it is the latest commit then just use it
      if (ref === latestRef) {
        return latestMatched;
      }
    }
    if (version && ms.version.includes(version)) {
      return { version: ms.version, matched: ref };
    }
  }
  return latestMatched;
}