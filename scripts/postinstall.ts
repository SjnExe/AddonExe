import { $ } from 'bun';

async function postinstallTask() {
    if (await Bun.file('.git/HEAD').exists()) {
        const hookPath = '.git/hooks/pre-commit';
        await Bun.write(hookPath, '#!/bin/sh\nbun scripts/pre-commit.ts\n');
        await $`chmod +x ${hookPath}`.quiet();
        console.log('⚙️  Native Git pre-commit verification hook bound.');
    }
}

postinstallTask().catch(console.error);
