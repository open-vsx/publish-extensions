#!/bin/sh -e

# Copyright (c) 2020 Ratchanan Srirattanamet and others
# This program and the accompanying materials are made available under the
# terms of the Eclipse Public License v. 2.0 which is available at
# http://www.eclipse.org/legal/epl-2.0.

# SPDX-License-Identifier: EPL-2.0

# This script is based on vscode-python's GitHub Actions, and assumes that
# the current directory is the repository.

# The script expects the user to pass in the build version.
ORIG_BUILD_VERSION=$1
if [ -z "$ORIG_BUILD_VERSION" ]; then
    echo "Usage: $0 <Original build version>"
    exit 1
fi

# Just in case
export PIP_USER=no

# Create a VirtualEnv for installing extension's Python dependencies
VENV=$(mktemp -d)
trap 'ret=$?; rm -rf $VENV; exit $?' INT TERM HUP QUIT

python -m venv "$VENV"
# shellcheck source=/dev/null
. "${VENV}/bin/activate"

# Install the extension's Python dependencies
python -m pip install wheel

python -m pip --disable-pip-version-check install -t ./pythonFiles/lib/python --no-cache-dir --implementation py --no-deps --upgrade -r requirements.txt

python -m pip --disable-pip-version-check install -r build/debugger-install-requirements.txt
python ./pythonFiles/install_debugpy.py

# Now update the build number. To make this version unique, we append a suffix.
BUILD_VERSION="${ORIG_BUILD_VERSION}+nojupyter"
npm run updateBuildNumber -- --buildNumber "$BUILD_VERSION"

# At this point, the GitHub Actions would update the extension dependencies so that
# it depends on Jupyter extension. However, the whole point of re-building this
# is so that we don't depend on it, so let's skip that and do the last step: build!
npm run package

# Finished. The extension file is available at ms-python-insiders.vsix
