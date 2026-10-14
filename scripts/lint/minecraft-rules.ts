const glob = new Bun.Glob('src/**/*.ts');
const ALLOWED_EXACT_STRINGS = new Set(['minecraft:', 'minecraft:script_unload']);

export async function validateMinecraftRules(): Promise<number> {
    let errors = 0;

    for await (const filePath of glob.scan('.')) {
        if (filePath.includes('__mocks__')) {
            continue;
        }

        const content = await Bun.file(filePath).text();
        const lines = content.split('\n');

        lines.forEach((line, idx) => {
            const trimmed = line.trim();
            if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
                return;
            }

            if (line.includes('.runCommandAsync(')) {
                console.error(`❌ ${filePath}:${idx + 1} -> runCommandAsync is deprecated. Use native APIs.`);
                errors++;
            }

            const matches = line.matchAll(/['"\x60](minecraft:[^'"\x60]*)['"\x60]/g);
            for (const match of matches) {
                const str = match[1];
                if (!str || ALLOWED_EXACT_STRINGS.has(str)) {
                    continue;
                }

                if (['getComponent', 'hasComponent', 'getComponentNet'].some((fn) => line.includes(`${fn}(`))) {
                    continue;
                }

                console.error(`❌ ${filePath}:${idx + 1} -> Magic string '${str}' detected. Use @minecraft/vanilla-data or @minecraft/server enums.`);
                errors++;
            }
        });
    }

    if (errors > 0) {
        console.error(`\n💥 Minecraft custom rule validation failed with ${errors} error(s).`);
    } else {
        console.log('✅ Custom Minecraft rules passed cleanly.');
    }

    return errors;
}

if (import.meta.main) {
    const errors = await validateMinecraftRules();
    if (errors > 0) {
        process.exit(1);
    }
}
