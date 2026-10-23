import { $ } from 'bun';

import { validateMinecraftRules } from './minecraft-rules.ts';

const rawArgs = process.argv.slice(2);
const skipCustomRules = rawArgs.includes('--skip-custom-rules');
const args = rawArgs.filter((a) => a !== '--skip-custom-rules');

if (!skipCustomRules) {
    const customErrors = await validateMinecraftRules();
    if (customErrors > 0) {
        process.exit(1);
    }
}

const termuxBin = '/data/data/com.termux/files/usr/bin/oxlint';
const result = (await Bun.file(termuxBin).exists()) ? await $`${termuxBin} ${args}`.nothrow() : await $`bunx oxlint ${args}`.nothrow();

process.exit(result.exitCode);
