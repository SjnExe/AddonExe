const glob = new Bun.Glob('src/**/*.ts');
const ALLOWED_EXACT_STRINGS = new Set(['minecraft:', 'minecraft:script_unload']);

let errors = 0;

for await (const filePath of glob.scan('.')) {
    const content = await Bun.file(filePath).text();
    const lines = content.split('\n');

    lines.forEach((line, idx) => {
        if (line.includes('.runCommandAsync(')) {
            console.error(`❌ ${filePath}:${idx + 1} -> runCommandAsync is deprecated. Use native APIs.`);
            errors++;
        }

        const matches = line.matchAll(/['"`](minecraft:[^'"`]*)['"`]/g);
        for (const match of matches) {
            const str = match[1];
            if (ALLOWED_EXACT_STRINGS.has(str)) {
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
    process.exit(1);
} else {
    console.log('✅ Custom Minecraft rules passed cleanly.');
}
