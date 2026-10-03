import { $ } from 'bun';
import fs from 'node:fs/promises';
import path from 'node:path';
const ROOT_DIR = path.resolve(import.meta.dirname, '..');
async function main() {
    console.log('🔍 Running project dependency verification...');
    await $`bun scripts/check-dependencies.ts`;

    const scriptEntry = path.join(ROOT_DIR, 'packs/behavior/scripts/main.js');
    try {
        await fs.access(scriptEntry);
    } catch {
        console.error('❌ packs/behavior/scripts/main.js not found. Run "bun run build" first.');
        process.exit(1);
    }

    console.log('🧪 Running Minecraft Creator Tools (mct) validation...');
    const exclusions = ['PRJINT', 'UNKJSON', 'pathlength', 'PATHLENGTH', 'BASEGAMEVER', 'WPACKREFS', 'JSON', 'STRICT', 'ENTITYTYPE', 'FORMATVER', 'ITEMTYPE', 'CHKMANIF', 'FORBFILE'].join(',');

    await $`bunx mct validate default ${exclusions} -i packs`;
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
