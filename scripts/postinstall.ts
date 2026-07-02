import { $ } from 'bun';

// Check if running inside Termux
const termuxDir = Bun.file('/data/data/com.termux');

if (await termuxDir.exists()) {
    try {
        // Check if cargo is available in path
        await $`command -v cargo`.quiet();

        console.log('⚡ Termux detected: Compiling native jscpd with LLVM optimization...');
        await $`RUSTFLAGS="-C link-arg=-fuse-ld=lld" cargo install jscpd`;

        console.log('🧹 Smart cleaning Cargo bloat...');
        const home = process.env.HOME;
        if (home) {
            await $`rm -rf ${home}/.cargo/registry/src ${home}/.cargo/registry/cache`.quiet();
        }
    } catch {
        console.log('\n⚠️ [Termux Warning]: cargo not found. Run "pkg install rust lld" to enable optimized jscpd support.\n');
    }
}
