import { $ } from 'bun';
import fs from 'fs';
import os from 'os';

const isTermux = fs.existsSync('/data/data/com.termux');
const jscpdBin = isTermux ? `${os.homedir()}/.cargo/bin/jscpd` : 'jscpd';

await $`${jscpdBin} src/ --min-lines 5 --min-tokens 40 --max-lines 1000 --ignore "src/**/__tests__/**"`;
