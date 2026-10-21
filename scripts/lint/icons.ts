import path from 'node:path';
import ignoredTextures from './ignored-textures.json';

const ROOT_DIR = path.resolve(import.meta.dirname, '../..');
const CACHE_FILE = path.resolve(ROOT_DIR, '.cache/vanilla_textures.json');
const SRC_DIR = path.resolve(ROOT_DIR, 'src');
const RESOURCE_PACK_DIR = path.resolve(ROOT_DIR, 'packs/resource/textures');

async function fetchVanillaTextures(): Promise<Set<string>> {
    const validTextures = new Set<string>();

    try {
        const cacheFile = Bun.file(CACHE_FILE);
        if (await cacheFile.exists()) {
            const data = await cacheFile.json();
            if (Array.isArray(data) && data.length > 0) {
                console.log('[IconLint] Using cached vanilla textures.');
                data.forEach((t) => validTextures.add(t));
                return validTextures;
            }
        }
    } catch {
        // Cache missing or invalid
    }

    console.log('[IconLint] Fetching vanilla textures from GitHub...');
    const texturesToCache: string[] = [];
    const session = typeof Bun.FetchSession === 'function' ? new Bun.FetchSession() : undefined;
    const ghFetch = session ? session.fetch.bind(session) : fetch;

    try {
        // 1. Fetch item textures
        const itemRes = await ghFetch('https://raw.githubusercontent.com/Mojang/bedrock-samples/main/resource_pack/textures/item_texture.json');
        const itemText = await itemRes.text();
        const itemJson = Bun.JSON5.parse(itemText) as any;
        for (const key in itemJson.texture_data) {
            const tex = itemJson.texture_data[key].textures;
            if (Array.isArray(tex)) {
                tex.forEach((t: any) => (typeof t === 'string' ? texturesToCache.push(t) : texturesToCache.push(t.path)));
            } else if (typeof tex === 'string') {
                texturesToCache.push(tex);
            }
        }

        // 2. Fetch terrain textures
        const terrainRes = await ghFetch('https://raw.githubusercontent.com/Mojang/bedrock-samples/main/resource_pack/textures/terrain_texture.json');
        const terrainText = await terrainRes.text();
        const terrainJson = Bun.JSON5.parse(terrainText) as any;
        for (const key in terrainJson.texture_data) {
            const tex = terrainJson.texture_data[key].textures;
            if (Array.isArray(tex)) {
                tex.forEach((t: any) => (typeof t === 'string' ? texturesToCache.push(t) : texturesToCache.push(t.path)));
            } else if (typeof tex === 'string') {
                texturesToCache.push(tex);
            }
        }

        // 3. Fetch texture list
        const listRes = await ghFetch('https://raw.githubusercontent.com/Mojang/bedrock-samples/main/resource_pack/textures/texture_list.json');
        const listText = await listRes.text();
        const listJson = Bun.JSON5.parse(listText) as any;
        if (Array.isArray(listJson)) {
            listJson.forEach((t: string) => texturesToCache.push(t));
        }

        // 4. Fetch UI textures from Git tree or extract from Bedrock UI JSON files if rate limited
        let uiTexturesFound = false;
        try {
            const headers = process.env.GITHUB_TOKEN ? { Authorization: 'token ' + process.env.GITHUB_TOKEN } : {};
            const treeRes = await fetch('https://api.github.com/repos/Mojang/bedrock-samples/git/trees/main?recursive=1', { headers });
            const treeJson = await treeRes.json();
            if (treeJson.tree && Array.isArray(treeJson.tree)) {
                for (const node of treeJson.tree) {
                    if (node.path && node.path.startsWith('resource_pack/textures/ui/') && node.path.endsWith('.png')) {
                        const texPath = node.path.replace('resource_pack/', '').replace('.png', '');
                        texturesToCache.push(texPath);
                        uiTexturesFound = true;
                    }
                }
            }
        } catch {
            // Rate limit or network error
        }

        if (!uiTexturesFound) {
            console.log('[IconLint] GitHub tree API unaccessible, extracting UI texture references from Bedrock UI JSON files via _ui_defs.json...');
            try {
                const defsRes = await ghFetch('https://raw.githubusercontent.com/Mojang/bedrock-samples/main/resource_pack/ui/_ui_defs.json');
                if (defsRes.ok) {
                    const defsJson = Bun.JSON5.parse(await defsRes.text()) as any;
                    const uiFiles: string[] = defsJson.ui_defs || [];
                    await Promise.all(
                        uiFiles.map(async (file) => {
                            try {
                                const res = await ghFetch(`https://raw.githubusercontent.com/Mojang/bedrock-samples/main/resource_pack/${file}`);
                                if (res.ok) {
                                    const text = await res.text();
                                    const matches = text.match(/textures\/ui\/[a-zA-Z0-9_\-/]+/g);
                                    if (matches) {
                                        matches.forEach((m) => texturesToCache.push(m));
                                    }
                                }
                            } catch {
                                // Ignore individual fetch failure
                            }
                        })
                    );
                }
            } catch {
                // Fallback failed
            }
        }

        await Bun.write(CACHE_FILE, JSON.stringify(texturesToCache, null, 2));

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
    const pngGlob = new Bun.Glob('**/*.png');
    const pngFiles = Array.from(pngGlob.scanSync({ cwd: RESOURCE_PACK_DIR, absolute: false }));

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
    const tsGlob = new Bun.Glob('**/*.ts');
    const tsFiles = Array.from(tsGlob.scanSync({ cwd: SRC_DIR, absolute: true }));
    const _regex = /'((?:textures\/)[^']+)'|"((?:textures\/)[^"]+)"|`((?:textures\/)[^`]+)`/g;

    // Map of icon path to array of files it was found in
    const usedIcons = new Map<string, string[]>();

    await Promise.all(
        tsFiles.map(async (file) => {
            try {
                const content = await Bun.file(file).text();
                if (!content.includes('textures/')) {
                    return;
                }
                const localRegex = /'((?:textures\/)[^']+)'|"((?:textures\/)[^"]+)"|`((?:textures\/)[^`]+)`/g;
                let match;
                while ((match = localRegex.exec(content)) !== null) {
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
        })
    );

    return usedIcons;
}

const IGNORED_TEXTURES = new Set<string>(ignoredTextures);

export async function validateIcons() {
    console.log('--- Starting Icon Validation ---');

    const [vanillaTextures, customTextures, usedIcons] = await Promise.all([fetchVanillaTextures(), getCustomTextures(), extractUsedIcons()]);

    let errors = 0;

    for (const [icon, files] of usedIcons.entries()) {
        // Skip dynamically interpolated string templates like `textures/blocks/${id}` since we can't validate them statically
        if (icon.includes('${')) {
            continue;
        }

        if (!vanillaTextures.has(icon) && !customTextures.has(icon) && !IGNORED_TEXTURES.has(icon)) {
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

if (import.meta.main) {
    validateIcons().catch((err) => {
        console.error(err);
        process.exit(1);
    });
}
