//@ts-check

const token = process.env.GITHUB_TOKEN;

const Octokit = require('octokit').Octokit;
const octokit = new Octokit({ auth: token });

(async () => {
    const isLastFailedRun = (await octokit.rest.actions.listWorkflowRuns({owner: "open-vsx", repo: "publish-extensions", workflow_id: 19084047, per_page: 1})).data.workflow_runs.filter(run => run.conclusion === "failure").length > 0;
    return isLastFailedRun;
})()