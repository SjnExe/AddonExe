const glob = new Bun.Glob('src/**/*.ts');
const ALLOWED_EXACT_STRINGS = new Set(['minecraft:', 'minecraft:script_unload']);
const UNNECESSARY_COMMANDS_REGEX =
    /\.runCommand\(\s*['"\x60]\/?(?:tp|teleport|tag|xp|effect|gamemode|setblock|fill|clear|kill|playsound|say|tell|w|msg|title|summon|time|weather|gamerule|scoreboard)\b/;

export async function validateMinecraftRules(): Promise<number> {
    const filePaths = Array.from(glob.scanSync('.')).filter((p) => !p.includes('__mocks__'));
    let errors = 0;

    await Promise.all(
        filePaths.map(async (filePath) => {
            const content = await Bun.file(filePath).text();
            if (!content.includes('runCommandAsync(') && !content.includes('runCommand(') && !content.includes('minecraft:')) {
                return;
            }

            const lines = content.split('\n');
            for (let idx = 0; idx < lines.length; idx++) {
                const line = lines[idx]!;
                const trimmed = line.trim();
                if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
                    continue;
                }

                if (line.includes('.runCommandAsync(')) {
                    console.error(`❌ ${filePath}:${idx + 1} -> runCommandAsync is deprecated. Use native APIs.`);
                    errors++;
                }

                if (UNNECESSARY_COMMANDS_REGEX.test(line)) {
                    console.error(`❌ ${filePath}:${idx + 1} -> Avoid unnecessary command in runCommand(). Use native @minecraft/server APIs instead.`);
                    errors++;
                }

                if (line.includes('minecraft:')) {
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
                }
            }
        })
    );

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
