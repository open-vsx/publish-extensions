const Octokit = require('octokit').Octokit;
const path = require('path');
const fs = require('fs');

const readVSIXPackage = require('@vscode/vsce/out/zip').readVSIXPackage;
const download = require('download');
const exec = require('../lib/exec');

const token = process.env.GITHUB_TOKEN;
if (!token) {
    throw new Error("GITHUB_TOKEN env var is not set. Cannot lookup from actions");
}

const octokit = new Octokit({ auth: token });

const repoInfo = {
    owner: 'microsoft',
    repo: 'vscode-jupyter',
}

const paths = {
    package: 'ms-toolsai-jupyter-insiders.vsix',
    folder: "/tmp/download/jupyter"
}

const resolveVersion = async (version, lastUpdated) => {
    const actionRuns = await octokit.rest.actions.listWorkflowRuns(
        {
            ...repoInfo,
            per_page: 100,
            workflow_id: 'build-test.yml',
            exclude_pull_requests: true,
            status: 'success',
        }
    );

    const actionRunsForTag = actionRuns.data.workflow_runs.filter(run => new Date(run.run_started_at) < lastUpdated.getTime());

    console.info(`Found ${actionRunsForTag.length} matching runs for ${version}`)

    // try to find the correct run
    for (const run of actionRunsForTag) {
        const runArtifacts = await octokit.rest.actions.listWorkflowRunArtifacts({ ...repoInfo, run_id: run.id });
        const runArtifactsForVersion = runArtifacts.data.artifacts.filter(artifact => artifact.name === paths.package);
        if (runArtifactsForVersion.length === 1) {
            const artifact = runArtifactsForVersion[0];
            const artifactDownload = await octokit.rest.actions.downloadArtifact({ ...repoInfo, artifact_id: artifact.id, archive_format: 'zip' });
            const artifactDownloadUrl = artifactDownload.url;
            const file = `/tmp/download/jupyter.zip`;
            await download(artifactDownloadUrl, path.dirname(file), { filename: path.basename(file) });
            fs.rmSync(paths.folder, { recursive: true, force: true });
            await exec(`unzip ${file} -d ${paths.folder}`, {quiet: true});

            const extractedFile = `${paths.folder}/${paths.package}`;
            const { manifest, xmlManifest } = (await readVSIXPackage(extractedFile));
            const resolvedVersion = xmlManifest.PackageManifest.Metadata[0].Identity[0].$.Version || manifest.version;

            if (resolvedVersion === version) {
                console.log(`Found the correct version: ${resolvedVersion}`);
                break;
            } else if (version.startsWith(resolvedVersion)) {
                console.log(`Found a similar-enough version: ${resolvedVersion}`);
                return { version: version, files: {universal: extractedFile}, path: '', resolution: { releaseAsset: 'resolved' } };
            } else {
                console.log(`Found non-matching version ${resolvedVersion}`);
            }
        }
    }
    
    return undefined;
}

module.exports = {
    resolveVersion
};