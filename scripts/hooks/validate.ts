import { $ } from 'bun';
import path from 'node:path';
const ROOT_DIR = path.resolve(import.meta.dirname, '../..');
async function main() {
    console.log('🔍 Running project dependency verification...');
    await $`bun scripts/build/check-dependencies.ts`;

    const scriptEntry = path.join(ROOT_DIR, 'packs/behavior/scripts/main.js');
    if (!(await Bun.file(scriptEntry).exists())) {
        console.error('❌ packs/behavior/scripts/main.js not found. Run "bun run build" first.');
        process.exit(1);
    }

    console.log('🧪 Running Minecraft Creator Tools (mct) validation...');
    const exclusions = ['pathlength', 'PATHLENGTH', 'BASEGAMEVER', 'UNKJSON'].join(',');

    await $`bunx mct validate default ${exclusions} -i packs`;
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
