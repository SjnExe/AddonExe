import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { globSync } from 'glob';
import JSON5 from 'json5';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_DIR = path.resolve(__dirname, '../../.cache');
const CACHE_FILE = path.join(CACHE_DIR, 'vanilla_textures.json');
const SRC_DIR = path.resolve(__dirname, '../../src');
const RESOURCE_PACK_DIR = path.resolve(__dirname, '../../packs/resource/textures');

async function ensureCacheDir() {
    try {
        await fs.mkdir(CACHE_DIR, { recursive: true });
    } catch {
        // Ignore error
    }
}

async function fetchVanillaTextures(): Promise<Set<string>> {
    const validTextures = new Set<string>();

    try {
        const cached = await fs.readFile(CACHE_FILE, 'utf-8');
        const data = JSON.parse(cached);
        if (Array.isArray(data) && data.length > 0) {
            console.log('[IconLint] Using cached vanilla textures.');
            data.forEach((t) => validTextures.add(t));
            return validTextures;
        }
    } catch {
        // Cache missing or invalid
    }

    console.log('[IconLint] Fetching vanilla textures from GitHub...');
    const texturesToCache: string[] = [];

    try {
        // 1. Fetch item textures
        const itemRes = await fetch('https://raw.githubusercontent.com/Mojang/bedrock-samples/main/resource_pack/textures/item_texture.json');
        const itemText = await itemRes.text();
        const itemJson = JSON5.parse(itemText);
        for (const key in itemJson.texture_data) {
            const tex = itemJson.texture_data[key].textures;
            if (Array.isArray(tex)) {
                tex.forEach((t: any) => typeof t === 'string' ? texturesToCache.push(t) : texturesToCache.push(t.path));
            } else if (typeof tex === 'string') {
                texturesToCache.push(tex);
            }
        }

        // 2. Fetch terrain textures
        const terrainRes = await fetch('https://raw.githubusercontent.com/Mojang/bedrock-samples/main/resource_pack/textures/terrain_texture.json');
        const terrainText = await terrainRes.text();
        const terrainJson = JSON5.parse(terrainText);
        for (const key in terrainJson.texture_data) {
            const tex = terrainJson.texture_data[key].textures;
            if (Array.isArray(tex)) {
                tex.forEach((t: any) => typeof t === 'string' ? texturesToCache.push(t) : texturesToCache.push(t.path));
            } else if (typeof tex === 'string') {
                texturesToCache.push(tex);
            }
        }

        // 3. Fetch texture list
        const listRes = await fetch('https://raw.githubusercontent.com/Mojang/bedrock-samples/main/resource_pack/textures/texture_list.json');
        const listText = await listRes.text();
        const listJson = JSON5.parse(listText);
        if (Array.isArray(listJson)) {
            listJson.forEach((t: string) => texturesToCache.push(t));
        }

        // 4. Fetch UI textures from git tree
        const treeRes = await fetch('https://api.github.com/repos/Mojang/bedrock-samples/git/trees/main?recursive=1');
        const treeJson = await treeRes.json();
        if (treeJson.tree) {
            for (const node of treeJson.tree) {
                if (node.path && node.path.startsWith('resource_pack/textures/ui/') && node.path.endsWith('.png')) {
                    const texPath = node.path.replace('resource_pack/', '').replace('.png', '');
                    texturesToCache.push(texPath);
                }
            }
        }

        await ensureCacheDir();
        await fs.writeFile(CACHE_FILE, JSON.stringify(texturesToCache, null, 2), 'utf-8');

        texturesToCache.forEach((t) => validTextures.add(t));
        console.log(`[IconLint] Cached ${validTextures.size} vanilla textures.`);
    } catch (e) {
        console.error('[IconLint] Failed to fetch vanilla textures:', e);
        process.exit(1);
    }

    return validTextures;
}

async function getCustomTextures(): Promise<Set<string>> {
    const customTextures = new Set<string>();
    const pngFiles = globSync('**/*.png', { cwd: RESOURCE_PACK_DIR, absolute: false });

    for (const file of pngFiles) {
        // e.g. "ui/my_icon.png" -> "textures/ui/my_icon"
        const noExt = file.replace(/\.png$/, '');
        // standard bedorck path delimiter is forward slash
        const normalized = noExt.split(path.sep).join('/');
        customTextures.add(`textures/${normalized}`);
    }

    console.log(`[IconLint] Found ${customTextures.size} custom textures in local resource pack.`);
    return customTextures;
}

async function extractUsedIcons(): Promise<Map<string, string[]>> {
    const tsFiles = globSync('**/*.ts', { cwd: SRC_DIR, absolute: true });
    const regex = /'((?:textures\/)[^']+)'|"((?:textures\/)[^"]+)"|`((?:textures\/)[^`]+)`/g;

    // Map of icon path to array of files it was found in
    const usedIcons = new Map<string, string[]>();

    for (const file of tsFiles) {
        try {
            const content = await fs.readFile(file, 'utf-8');
            let match;
            while ((match = regex.exec(content)) !== null) {
                // If it ends with .png in the code, strip it for validation since Bedrock accepts both and our validator stores them without .png
                const iconPath = match[1] || match[2] || match[3];
                if (iconPath) {
                    const cleanPath = iconPath.replace(/\.png$/, '');
                    if (!usedIcons.has(cleanPath)) {
                        usedIcons.set(cleanPath, []);
                    }
                    usedIcons.get(cleanPath)!.push(file.replace(SRC_DIR, 'src'));
                }
            }
        } catch {
            // Ignore error
        }
    }

    return usedIcons;
}

async function validate() {
    console.log('--- Starting Icon Validation ---');

    const [vanillaTextures, customTextures, usedIcons] = await Promise.all([
        fetchVanillaTextures(),
        getCustomTextures(),
        extractUsedIcons()
    ]);

    let errors = 0;

    for (const [icon, files] of usedIcons.entries()) {
        // Skip dynamically interpolated string templates like `textures/blocks/${id}` since we can't validate them statically
        if (icon.includes('${')) {
            continue;
        }

        if (!vanillaTextures.has(icon) && !customTextures.has(icon)) {
            console.error(`\x1b[31m[Error] Invalid texture path:\x1b[0m ${icon}`);
            console.error(`  Found in:`);
            const uniqueFiles = Array.from(new Set(files));
            for (const file of uniqueFiles) {
                console.error(`    - ${file}`);
            }
            errors++;
        }
    }

    if (errors > 0) {
        console.error(`\n\x1b[31m[IconLint] Validation failed. Found ${errors} invalid texture path(s).\x1b[0m`);
        process.exit(1);
    } else {
        console.log(`\n\x1b[32m[IconLint] All ${usedIcons.size} texture paths are valid!\x1b[0m`);
    }
}

validate().catch((err) => {
    console.error(err);
    process.exit(1);
});
