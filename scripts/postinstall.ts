import { $ } from 'bun';
import { existsSync } from 'node:fs';

async function postinstallTask() {
    if (existsSync('.git')) {
        const hookPath = '.git/hooks/pre-commit';
        await Bun.write(hookPath, '#!/bin/sh\nbun scripts/pre-commit.ts\n');
        await $`chmod +x ${hookPath}`.quiet();
        console.log('⚙️  Native Git pre-commit verification hook bound.');
    }
}

postinstallTask().catch(console.error);
