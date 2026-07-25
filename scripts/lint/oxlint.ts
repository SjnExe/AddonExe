import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const termuxBin = '/data/data/com.termux/files/usr/bin/oxlint';
const bin = existsSync(termuxBin) ? termuxBin : 'oxlint';

const args = process.argv.slice(2);
const result = spawnSync(bin, args, { stdio: 'inherit', env: process.env });

process.exit(result.status ?? 0);
