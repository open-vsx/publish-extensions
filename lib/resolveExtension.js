
// @ts-check
const fs = require('fs');
const path = require('path');
const Octokit = require('octokit').Octokit;
const readVSIXPackage = require('vsce/out/zip').readVSIXPackage;
const download = require('download');
const exec = require('./exec');

const token = process.env.GITHUB_TOKEN;
if (!token) {
  throw new Error("GITHUB_TOKEN env var is not set");
}
const octokit = new Octokit({ auth: token });

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

  const repoPath = '/tmp/repository';
  await exec(`git clone --recurse-submodules ${repository} ${repoPath}`, { quiet: true });

  const packagePath = [repoPath, location, 'package.json'].filter(p => !!p).join('/');
  /**
   * @param {string} ref 
   * @returns {Promise<string | undefined>}
   */
  async function resolveVersion(ref) {
    try {
      await exec(`git reset --hard ${ref} --quiet`, { cwd: repoPath, quiet: true });
      const manifest = JSON.parse(await fs.promises.readFile(packagePath, 'utf-8'));
      if (`${manifest.publisher}.${manifest.name}`.toLowerCase() !== id.toLowerCase()) {
        return undefined;
      }
      return manifest.version;
    } catch {
      return undefined;
    }
  }

  const latestCommit = (await exec(`git log -1 --oneline --format="%H %cD"`, { cwd: repoPath, quiet: true }))
    .stdout.split('\n').map(r => r.trim()).filter(r => !!r).map(r => {
      const index = r.indexOf(' ');
      const sha = r.substring(0, index);
      const date = r.substring(index);
      return { sha, date: new Date(date) };
    })[0];

  const until = new Date(ms.lastUpdated.getTime() + 12 * (60 * 60 * 1000));
  until.setUTCHours(23, 59, 59, 999);
  const matchedCommits = (await exec(`git log -30 --oneline --format="%H %cD" --until="${until.toISOString()}"`, { cwd: repoPath, quiet: true }))
    .stdout.split('\n').map(r => r.trim()).filter(r => !!r).map(r => {
      const index = r.indexOf(' ');
      const sha = r.substring(0, index);
      const date = r.substring(index);
      return { sha, date: new Date(date) };
    });

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
        return { version: ms.version, ref: { path: repoPath, releaseTag: release.tag_name } };
      }
    } catch { }

    // tags
    const tags = (await exec(`git log -3 --no-walk --tags --oneline --format="%H"`, { cwd: repoPath, quiet: true })).stdout.split('\n').map(t => t.trim()).filter(t => !!t);
    for (const tag of tags) {
      const version = await resolveVersion(tag)
      if (version && ms.version.includes(version)) {
        return { version: ms.version, ref: { path: repoPath, tag } };
      }
    }
  }

  // if latest commit is too old like 3 months old then we just use last commit
  if (!ms) {
    if (!latestCommit) {
      return undefined;
    }
    const version = await resolveVersion(latestCommit.sha);
    if (!version) {
      return undefined;
    }
    return { version, ref: { path: repoPath, latest: latestCommit.sha } };
  }

  if (latestCommit) {
    const longTimeAgo = new Date();
    longTimeAgo.setMonth(longTimeAgo.getMonth() - 2);
    if (longTimeAgo.getTime() > latestCommit.date.getTime()) {
      const version = await resolveVersion(latestCommit.sha);
      if (version) {
        return { version, ref: { path: repoPath, latest: latestCommit.sha } };
      }
    }
  }

  // match commit around last updated date
  let latestMatched;
  // otherwise look for matchig
  for (const [index, commit] of matchedCommits.entries()) {
    const ref = commit.sha;
    const version = await resolveVersion(ref);
    if (index === 0 && version) {
      latestMatched = { version, ref: { path: repoPath, matchedLatest: ref } };
      // if it is the latest commit then just use it
      if (ref === latestCommit.sha) {
        return latestMatched;
      }
    }
    if (version && ms.version.includes(version)) {
      return { version: ms.version, ref: { path: repoPath, matched: ref } };
    }
  }
  return latestMatched;
}