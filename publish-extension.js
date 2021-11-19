/********************************************************************************
 * Copyright (c) 2020 TypeFox and others
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * SPDX-License-Identifier: EPL-2.0
 ********************************************************************************/

// @ts-check
const fs = require('fs');
const ovsx = require('ovsx');
const readVSIXPackage = require('vsce/out/zip').readVSIXPackage;
const path = require('path');
const semver = require('semver');
const exec = require('./lib/exec');

(async () => {
    /**
     * @type {{extension: import('./types').Extension, context: import('./types').PublishContext}}
     */
    const { extension, context } = JSON.parse(process.argv[2]);
    console.log(`\nProcessing extension: ${JSON.stringify({ extension, context }, undefined, 2)}`);
    try {
        const { id } = extension;
        const [namespace] = id.split('.');

        /** @type {import('ovsx').PublishOptions} */
        let options;
        if (context.file) {
            options = { extensionFile: context.file };
        } else if (context.ref) {
            console.log(`${id}: preparing from ${context.ref}...`);
            const repoPath = '/tmp/repository';
            let packagePath = repoPath;
            if (extension.location) {
                packagePath = path.join(packagePath, extension.location);
            }
            // Clone and set up the repository.
            await exec(`git clone --recurse-submodules ${extension.repository} ${repoPath}`);
            if (context.ref) {
                await exec(`git checkout ${context.ref}`, { cwd: repoPath });
            }
            let yarn = await new Promise(resolve => {
                fs.access(path.join(repoPath, 'yarn.lock'), error => resolve(!error));
            });
            try {
                await exec(`${yarn ? 'yarn' : 'npm'} install`, { cwd: packagePath });
            } catch (e) {
                const pck = JSON.parse(await fs.promises.readFile(path.join(packagePath, 'package.json'), 'utf-8'));
                // try to auto migrate from vscode: https://code.visualstudio.com/api/working-with-extensions/testing-extension#migrating-from-vscode
                if (pck.scripts?.postinstall === 'node ./node_modules/vscode/bin/install') {
                    delete pck.scripts['postinstall'];
                    const devDependencies = pck.devDependencies || {};
                    delete pck.devDependencies['vscode'];
                    pck.devDependencies['@types/vscode'] = 'latest';
                    await fs.promises.writeFile(path.join(packagePath, 'package.json'), JSON.stringify(pck, undefined, 2), 'utf-8')
                    await exec(`${yarn ? 'yarn' : 'npm'} install`, { cwd: packagePath });
                } else {
                    throw e;
                }
            }
            if (extension.prepublish) {
                await exec(extension.prepublish, { cwd: repoPath })
            }

            if (extension.extensionFile) {
                options = { extensionFile: path.join(repoPath, extension.extensionFile) };
            } else {
                options = { packagePath };
            }
            if (yarn) {
                options.yarn = true;
            }
            console.log(`${id}: prepared from ${context.ref}`);
        }

        // Check if the requested version is greater than the one on Open VSX.        
        let version;
        if (options.extensionFile) {
            version = (await readVSIXPackage(options.extensionFile)).manifest.version;
        } else if (options.packagePath) {
            version = JSON.parse(await fs.promises.readFile(path.join(options.packagePath, 'package.json'), 'utf-8')).version;
        }
        context.version = version;

        if (!version) {
            throw new Error(`${extension.id}: version is not resolved`);
        }
        if (context.ovsxVersion) {
            if (semver.gt(context.ovsxVersion, version)) {
                throw new Error(`extensions.json is out-of-date: Open VSX version ${context.ovsxVersion} is already greater than specified version ${version}`);
            }
            if (semver.eq(context.ovsxVersion, version)) {
                console.log(`[SKIPPED] Requested version ${version} is already published on Open VSX`);
                return;
            }
        }

        if (process.env.SKIP_PUBLISH === 'true') {
            return;
        }
        console.log(`Attempting to publish ${id} to Open VSX`);

        // Create a public Open VSX namespace if needed.
        try {
            await ovsx.createNamespace({ name: namespace });
        } catch (error) {
            console.log(`Creating Open VSX namespace failed -- assuming that it already exists`);
            console.log(error);
        }

        await ovsx.publish(options);
        console.log(`[OK] Successfully published ${id} to Open VSX!`);

    } catch (error) {
        if (error && String(error).indexOf('is already published.') !== -1) {
            console.log(`Could not process extension -- assuming that it already exists`);
            console.log(error);
        } else {
            console.error(`[FAIL] Could not process extension: ${JSON.stringify({ extension, context }, null, 2)}`);
            console.error(error);
            process.exitCode = -1;
        }
    }
})();
