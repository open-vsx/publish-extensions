/********************************************************************************
 * Copyright (c) 2021 Gitpod and others
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * SPDX-License-Identifier: EPL-2.0
 ********************************************************************************/

//
// Usage:
//   node add-extension.js ext.id https://github.com/my-org/repo
// Optional extra arguments:
//   node add-extension.js abusaidm.html-snippets2 https://github.com/my-org/repo --location 'packages/xy'
//

// @ts-check
const fs = require('fs');
const minimist = require('minimist');
const util = require('util');

(async () => {
    const argv = minimist(process.argv.slice(2));

    if (argv._.length < 2) {
        console.error('Need two postional arguments: ext-id, repo-url');
        process.exit(1);
    }
    const [extID, repoURL] = argv._;
    delete argv._; // all other non-positional will be put in the extension's definition
    const extDefinition = {
        repository: repoURL,
        ...argv
    };
    console.log('Adding extension:', util.inspect(extDefinition, { colors: true, compact: false }));

    // Read current file
    const extensions = Object.entries(JSON.parse(await fs.promises.readFile('./extensions.json', { encoding: 'utf8' })));
    // Sort extensions (most are, but not always)
    extensions.sort(([k1], [k2]) => k1.localeCompare(k2));

    // Find position & insert extension
    for (let i = 0; i < extensions.length; i++) {
        const [currentID] = extensions[i];
        // console.debug(i, currentID)
        const diff = currentID.localeCompare(extID, undefined, { sensitivity: 'base' });
        if (diff === 0) {
            console.error('Extension already defined:', currentID);
            process.exit(1);
        }
        if (diff > 0) {
            extensions.splice(i, 0, [extID, extDefinition]);
            break;
        }
    }

    // Persist changes
    await fs.promises.writeFile(
        './extensions.json',
        JSON.stringify(Object.fromEntries(extensions), undefined, 2) + '\n', // add newline at EOF
        { encoding: 'utf8' }
    );
    console.log(`Successfully added ${extID}`);
})();