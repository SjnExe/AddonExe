import { $ } from 'bun';
import os from 'node:os';

const termuxDir = Bun.file('/data/data/com.termux');
const isTermux = await termuxDir.exists();

if (isTermux) {
    const jscpdBin = `${os.homedir()}/.cargo/bin/jscpd`;
    await $`${jscpdBin} src/ --min-lines 5 --min-tokens 40 --max-lines 1000 --ignore "src/**/__tests__/**"`;
} else {
    await $`bun --bun jscpd src/ --min-lines 5 --min-tokens 40 --max-lines 1000 --ignore "src/**/__tests__/**"`;
}
