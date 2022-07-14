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
const { createVSIX } = require('vsce');

(async () => {
    /**
     * @type {{extension: import('./types').Extension, context: import('./types').PublishContext}}
     */
    const { extension, context } = JSON.parse(process.argv[2]);
    console.log(`\nProcessing extension: ${JSON.stringify({ extension, context }, undefined, 2)}`);
    try {
        const { id } = extension;
        const [namespace] = id.split('.');

        let packagePath = context.repo;
        if (packagePath && extension.location) {
            packagePath = path.join(packagePath, extension.location);
        }

        /** @type {import('ovsx').PublishOptions} */
        let options;
        if (context.file) {
            options = { extensionFile: context.file };
        } else if (context.repo && context.ref) {
            console.log(`${id}: preparing from ${context.repo}...`);

            const [publisher, name] = extension.id.split('.');
            process.env.EXTENSION_ID = extension.id;
            process.env.EXTENSION_PUBLISHER = publisher;
            process.env.EXTENSION_NAME = name;
            process.env.VERSION = context.version;
            process.env.MS_VERSION = context.msVersion;
            process.env.OVSX_VERSION = context.ovsxVersion;
            await exec(`git checkout ${context.ref}`, { cwd: context.repo });
            if (extension.custom) {
                try {
                    for (const command of extension.custom) {
                        await exec(command, { cwd: context.repo });
                    }
                    options = { extensionFile: path.join(context.repo, extension.location ?? '.', 'extension.vsix') };
                } catch (e) {
                    throw e;
                }
            } else {
                const yarn = await new Promise(resolve => {
                    fs.access(path.join(context.repo, 'yarn.lock'), error => resolve(!error));
                });
                try {
                    await exec(`${yarn ? 'yarn' : 'npm'} install`, { cwd: packagePath });
                } catch (e) {
                    const pck = JSON.parse(await fs.promises.readFile(path.join(packagePath, 'package.json'), 'utf-8'));
                    // try to auto migrate from vscode: https://code.visualstudio.com/api/working-with-extensions/testing-extension#migrating-from-vscode
                    if (pck.scripts?.postinstall === 'node ./node_modules/vscode/bin/install') {
                        delete pck.scripts['postinstall'];
                        pck.devDependencies = pck.devDependencies || {};
                        delete pck.devDependencies['vscode'];
                        pck.devDependencies['@types/vscode'] = pck.engines['vscode'];
                        const content = JSON.stringify(pck, undefined, 2).replace(/node \.\/node_modules\/vscode\/bin\/compile/g, 'tsc');
                        await fs.promises.writeFile(path.join(packagePath, 'package.json'), content, 'utf-8');
                        await exec(`${yarn ? 'yarn' : 'npm'} install`, { cwd: packagePath });
                    } else {
                        throw e;
                    }
                }
                if (extension.prepublish) {
                    await exec(extension.prepublish, { cwd: context.repo })
                }
                if (extension.extensionFile) {
                    options = { extensionFile: path.join(context.repo, extension.extensionFile) };
                } else {
                    options = { extensionFile: path.join(context.repo, 'extension.vsix') };
                    if (yarn) {
                        options.yarn = true;
                    }
                    // answer y to all quetions https://github.com/microsoft/vscode-vsce/blob/7182692b0f257dc10e7fc643269511549ca0c1db/src/util.ts#L12
                    const vsceTests = process.env['VSCE_TESTS'];
                    process.env['VSCE_TESTS'] = '1';
                    try {
                        await createVSIX({
                            cwd: packagePath,
                            packagePath: options.extensionFile,
                            baseContentUrl: options.baseContentUrl,
                            baseImagesUrl: options.baseImagesUrl,
                            useYarn: options.yarn
                        });
                    } finally {
                        process.env['VSCE_TESTS'] = vsceTests;
                    }
                }
                console.log(`${id}: prepared from ${context.repo}`);
            }
        }

        // Check if the requested version is greater than the one on Open VSX.
        const { xmlManifest, manifest } = options.extensionFile && await readVSIXPackage(options.extensionFile);
        context.version = xmlManifest?.PackageManifest?.Metadata[0]?.Identity[0]['$']?.Version || manifest?.version;
        if (!context.version) {
            throw new Error(`${extension.id}: version is not resolved`);
        }

        if (context.ovsxVersion) {
            if (semver.gt(context.ovsxVersion, context.version)) {
                throw new Error(`extensions.json is out-of-date: Open VSX version ${context.ovsxVersion} is already greater than specified version ${context.version}`);
            }
            if (semver.eq(context.ovsxVersion, context.version)) {
                console.log(`[SKIPPED] Requested version ${context.version} is already published on Open VSX`);
                return;
            }
        }

        // TODO(ak) check license is open-source
        if (!xmlManifest?.PackageManifest?.Metadata[0]?.License?.[0] && !manifest.license && !(packagePath && await ovsx.isLicenseOk(packagePath, manifest))) {
            throw new Error(`${extension.id}: license is missing`);
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
