import { $ } from 'bun';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

const isTermux = existsSync('/data/data/com.termux');
const systemBinDir = '/data/data/com.termux/files/usr/bin';

async function postinstallTask() {
    if (existsSync('.git')) {
        const hookPath = '.git/hooks/pre-commit';
        await Bun.write(hookPath, '#!/bin/sh\nbun scripts/pre-commit.ts\n');
        await $`chmod +x ${hookPath}`.quiet();
        console.log('⚙️  Native Git pre-commit verification hook bound.');
    }

    if (isTermux) {
        // 1. Hot-swap system pre-built tsc binary into node_modules
        const systemTsc = path.join(systemBinDir, 'tsc');
        const binTscLink = path.join(process.cwd(), 'node_modules/.bin/tsc');

        if (existsSync(systemTsc)) {
            if (existsSync(binTscLink)) {
                const realPath = await fs.realpath(binTscLink).catch(() => binTscLink);
                await fs.rm(realPath, { force: true }).catch(() => {});
                await fs.copyFile(systemTsc, realPath).catch(() => {});
                await fs.chmod(realPath, 0o755).catch(() => {});
            }
            await fs.rm(binTscLink, { force: true }).catch(() => {});
            await fs.copyFile(systemTsc, binTscLink).catch(() => {});
            await fs.chmod(binTscLink, 0o755).catch(() => {});
            console.log('✅ Injected system pre-built tsc binary into node_modules/.bin/tsc');
        }

        // 2. Hot-swap system pre-built jscpd binary into node_modules
        const systemJscpd = path.join(systemBinDir, 'jscpd');
        if (existsSync(systemJscpd)) {
            // Overwrite node_modules/.bin/jscpd directly
            const binJscpdLink = path.join(process.cwd(), 'node_modules/.bin/jscpd');
            if (existsSync(binJscpdLink)) {
                const realPath = await fs.realpath(binJscpdLink).catch(() => binJscpdLink);
                await fs.rm(realPath, { force: true }).catch(() => {});
                await fs.copyFile(systemJscpd, realPath).catch(() => {});
                await fs.chmod(realPath, 0o755).catch(() => {});
            }
            await fs.rm(binJscpdLink, { force: true }).catch(() => {});
            await fs.copyFile(systemJscpd, binJscpdLink).catch(() => {});
            await fs.chmod(binJscpdLink, 0o755).catch(() => {});

            // Overwrite node_modules/jscpd/bin/jscpd JS wrapper script
            const pkgJscpdBin = path.join(process.cwd(), 'node_modules/jscpd/bin/jscpd');
            if (existsSync(path.dirname(pkgJscpdBin))) {
                await fs.rm(pkgJscpdBin, { force: true }).catch(() => {});
                await fs.copyFile(systemJscpd, pkgJscpdBin).catch(() => {});
                await fs.chmod(pkgJscpdBin, 0o755).catch(() => {});
            }

            // Create fake platform package structure for JS require checks
            const npmJscpdDir = path.join(process.cwd(), 'node_modules/jscpd-linux-arm64-gnu');
            const npmJscpdBinDir = path.join(npmJscpdDir, 'bin');
            const npmJscpdPath = path.join(npmJscpdBinDir, 'jscpd');

            await fs.mkdir(npmJscpdBinDir, { recursive: true });
            await fs.copyFile(systemJscpd, npmJscpdPath).catch(() => {});
            await fs.chmod(npmJscpdPath, 0o755).catch(() => {});
            await Bun.write(path.join(npmJscpdDir, 'package.json'), JSON.stringify({ name: 'jscpd-linux-arm64-gnu', version: '5.0.12' }));

            console.log('✅ Injected system pre-built jscpd binary wrapper into node_modules.');
        }
    }
}

postinstallTask().catch(console.error);
