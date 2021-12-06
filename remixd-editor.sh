#!/bin/bash
mkdir -p node_modules
npm install @remix-project/remixd
node ./node_modules/@remix-project/remixd/bin/remixd.js -s . --remix-ide https://remix.ethereum.org