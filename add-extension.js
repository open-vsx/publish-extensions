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
// Optional extra arguments [see: extensions-schema.json]:
//   node add-extension.js abusaidm.html-snippets2 https://github.com/my-org/repo --location 'packages/xy'
//

// @ts-check
const fs = require('fs');
const minimist = require('minimist');
const util = require('util');
const extensionsSchema = require('./extensions-schema.json');

(async () => {
    // Parse args
    const argv = minimist(process.argv.slice(2)); // without executable & script path

    // Check positional args
    if (argv._.length < 2) {
        console.error('Need two postional arguments: ext-id, repo-url');
        process.exit(1);
    }
    const [extID, repoURL] = argv._;
    const extDefinition = {
        repository: repoURL,
    };

    // Validate extra args
    delete argv._; // delete positional arguments
    for (const arg of Object.keys(argv)) {
        const propDef = extensionsSchema.additionalProperties.properties[arg];
        // console.debug(`arg=${arg}:`, argv[arg], propDef)
        if (!propDef) {
            console.error(`argument '${arg}' not found in ./extensions-schema.json`);
            process.exit(1);
        }

        // parse & validate value
        if (propDef.type === 'string') {
            extDefinition[arg] = String(argv[arg]) // minimist might've assumed a different type (e.g. number)
        } else if (propDef.type === 'number') { 
            if (typeof argv[arg] !== 'number') {
                console.error(`argument '${arg}' should be type '${propDef.type}' but yours seems to be '${typeof argv[arg]}'`);
                process.exit(1);
            }
            extDefinition[arg] = argv[arg] // numbers are parsed by minimist already
        } else {
            console.error(`argument '${arg}' is of type '${propDef.type}' which is not implemented by this script, sorry`);
            process.exit(1);
        }
    }
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