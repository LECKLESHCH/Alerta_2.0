#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const nvmrcPath = path.join(repoRoot, '.nvmrc');

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!fs.existsSync(nvmrcPath)) {
  fail('Missing .nvmrc in repository root.');
}

const required = fs.readFileSync(nvmrcPath, 'utf8').trim().replace(/^v/, '');
const current = process.versions.node;

if (current !== required) {
  fail(
    [
      `Node version mismatch: required v${required}, current v${current}.`,
      'Run: nvm use',
    ].join('\n'),
  );
}
