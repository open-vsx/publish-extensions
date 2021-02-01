
// @ts-check
const https = require('https');

exports.findLatestVSIXRelease = async function (repository) {
  const releasesUrl = repository + '/releases';
  console.log(`Scraping ${releasesUrl} to check for updates...`);
  const releases = await get(releasesUrl);
  const matches = releases.match(/\/releases\/download\/[-._a-zA-Z0-9\/%]*\.vsix/g) || [];
  const latestVSIXRelease = matches.filter(release => !/(nightly|-rc|-alpha|-dev|-next|-[iI]nsider|-beta|-pre)/.test(release)).shift();
  if (!latestVSIXRelease) {
    return null;
  }
  return repository + latestVSIXRelease;
}

function get (url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // Follow HTTP redirections
        get(res.headers.location).then(resolve, reject);
        return;
      }
      if (res.statusCode >= 400) {
        reject(new Error(`Couldn't get ${url} - Response status: ${res.statusCode}`));
        return;
      }
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('error', error => { reject(error); });
      res.on('end', () => { resolve(body); });
    }).on('error', error => {
      reject(error);
    });
  });
}
