import { $ } from 'bun';

async function runPipeline() {
    console.log('--- Starting Architecture Setup ---');
    console.log('🚀 Invoking project package ecosystem installation...');

    // Bun will pull tsc and jscpd securely from the RepoExe proxy!
    await $`bun install`;

    console.log('✨ System environment alignment fully operational.');
}

runPipeline().catch((err) => {
    console.error('❌ Critical failure within environment setup runtime:', err);
    process.exit(1);
});
