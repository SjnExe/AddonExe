import { execSync } from 'child_process';
import fs from 'fs';

// Check if running inside Termux
if (fs.existsSync('/data/data/com.termux')) {
    try {
        // Check if cargo is available in path
        execSync('command -v cargo', { stdio: 'ignore' });

        console.log('⚡ Termux detected: Compiling native jscpd with LLVM optimization...');
        execSync('RUSTFLAGS="-C link-arg=-fuse-ld=lld" cargo install jscpd', { stdio: 'inherit' });

        console.log('🧹 Smart cleaning Cargo bloat...');
        const home = process.env.HOME;
        if (home) {
            execSync(`rm -rf ${home}/.cargo/registry/src ${home}/.cargo/registry/cache`, { stdio: 'ignore' });
        }
    } catch {
        console.log('\n⚠️ [Termux Warning]: cargo not found. Run "pkg install rust lld" to enable optimized jscpd support.\n');
    }
}
