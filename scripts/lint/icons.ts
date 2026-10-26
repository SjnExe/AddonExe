import path from 'node:path';

const rootDir = path.resolve(import.meta.dirname, '../..');
const cacheFile = path.resolve(rootDir, '.cache/vanilla_textures.json');
const srcDir = path.resolve(rootDir, 'src');
const resourcePackDir = path.resolve(rootDir, 'packs/resource/textures');

export async function fetchVanillaTextures(): Promise<Set<string>> {
  const validTextures = new Set<string>();

  try {
    const file = Bun.file(cacheFile);
    if (await file.exists()) {
      const data = await file.json();
      if (Array.isArray(data) && data.length > 0) {
        console.log('[IconLint] Using cached vanilla textures.');
        for (const t of data) {
          validTextures.add(t);
          validTextures.add(String(t).toLowerCase());
        }
        return validTextures;
      }
    }
  } catch {
    // Cache missing or invalid
  }

  console.log('[IconLint] Fetching vanilla textures from GitHub...');
  const texturesToCache: string[] = [];

  try {
    const itemRes = await fetch(
      'https://raw.githubusercontent.com/Mojang/bedrock-samples/main/resource_pack/textures/item_texture.json',
    );
    const itemJson = Bun.JSON5.parse(await itemRes.text()) as any;
    for (const key in itemJson.texture_data) {
      const tex = itemJson.texture_data[key].textures;
      if (Array.isArray(tex)) {
        tex.forEach((t: any) => (typeof t === 'string' ? texturesToCache.push(t) : texturesToCache.push(t.path)));
      } else if (typeof tex === 'string') {
        texturesToCache.push(tex);
      }
    }

    const terrainRes = await fetch(
      'https://raw.githubusercontent.com/Mojang/bedrock-samples/main/resource_pack/textures/terrain_texture.json',
    );
    const terrainJson = Bun.JSON5.parse(await terrainRes.text()) as any;
    for (const key in terrainJson.texture_data) {
      const tex = terrainJson.texture_data[key].textures;
      if (Array.isArray(tex)) {
        tex.forEach((t: any) => (typeof t === 'string' ? texturesToCache.push(t) : texturesToCache.push(t.path)));
      } else if (typeof tex === 'string') {
        texturesToCache.push(tex);
      }
    }

    const listRes = await fetch(
      'https://raw.githubusercontent.com/Mojang/bedrock-samples/main/resource_pack/textures/texture_list.json',
    );
    const listJson = Bun.JSON5.parse(await listRes.text()) as any;
    if (Array.isArray(listJson)) {
      listJson.forEach((t: string) => texturesToCache.push(t));
    }

    let uiTexturesFound = false;
    try {
      const headers: Record<string, string> = process.env.GITHUB_TOKEN
        ? { Authorization: 'token ' + process.env.GITHUB_TOKEN }
        : {};
      const treeRes = await fetch('https://api.github.com/repos/Mojang/bedrock-samples/git/trees/main?recursive=1', {
        headers,
      });
      const treeJson = (await treeRes.json()) as any;
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
      // Fallback below
    }

    if (!uiTexturesFound) {
      try {
        const defsRes = await fetch(
          'https://raw.githubusercontent.com/Mojang/bedrock-samples/main/resource_pack/ui/_ui_defs.json',
        );
        if (defsRes.ok) {
          const defsJson = Bun.JSON5.parse(await defsRes.text()) as any;
          const uiFiles: string[] = defsJson.ui_defs || [];
          await Promise.all(
            uiFiles.map(async (file) => {
              try {
                const res = await fetch(
                  `https://raw.githubusercontent.com/Mojang/bedrock-samples/main/resource_pack/${file}`,
                );
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
            }),
          );
        }
      } catch {
        // Fallback failed
      }
    }

    await Bun.write(cacheFile, JSON.stringify(texturesToCache, null, 2));
    for (const t of texturesToCache) {
      validTextures.add(t);
      validTextures.add(t.toLowerCase());
    }
    console.log(`[IconLint] Cached ${texturesToCache.length} vanilla textures.`);
  } catch (e) {
    console.error('[IconLint] Failed to fetch vanilla textures:', e);
    process.exit(1);
  }

  return validTextures;
}

async function getCustomTextures(): Promise<Set<string>> {
  const customTextures = new Set<string>();
  const pngGlob = new Bun.Glob('**/*.png');
  const pngFiles = Array.from(pngGlob.scanSync({ cwd: resourcePackDir, absolute: false }));

  for (const file of pngFiles) {
    const noExt = file.replace(/\.png$/, '');
    const normalized = noExt.split(path.sep).join('/');
    customTextures.add(`textures/${normalized}`);
    customTextures.add(`textures/${normalized}`.toLowerCase());
  }

  console.log(`[IconLint] Found ${pngFiles.length} custom textures in local resource pack.`);
  return customTextures;
}

async function extractUsedIcons(): Promise<Map<string, string[]>> {
  const tsGlob = new Bun.Glob('**/*.ts');
  const tsFiles = Array.from(tsGlob.scanSync({ cwd: srcDir, absolute: true })).filter(
    (f) => !f.includes('__mocks__') && !f.includes('__tests__'),
  );
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
          if (iconPath && !iconPath.includes('${') && !iconPath.endsWith('/')) {
            const cleanPath = iconPath.replace(/\.png$/, '');
            if (!usedIcons.has(cleanPath)) {
              usedIcons.set(cleanPath, []);
            }
            usedIcons.get(cleanPath)!.push(file.replace(srcDir, 'src'));
          }
        }
      } catch {
        // Ignore error
      }
    }),
  );

  return usedIcons;
}

export async function validateIcons() {
  console.log('--- Starting Strict Icon Validation ---');

  const [vanillaTextures, customTextures, usedIcons] = await Promise.all([
    fetchVanillaTextures(),
    getCustomTextures(),
    extractUsedIcons(),
  ]);

  let errors = 0;

  for (const [icon, files] of usedIcons.entries()) {
    const lower = icon.toLowerCase();
    if (
      !vanillaTextures.has(icon) &&
      !vanillaTextures.has(lower) &&
      !customTextures.has(icon) &&
      !customTextures.has(lower)
    ) {
      console.error(`\x1b[31m[Error] Non-existent texture path:\x1b[0m ${icon}`);
      console.error('  Found in:');
      for (const file of new Set(files)) {
        console.error(`    - ${file}`);
      }
      errors++;
    }
  }

  if (errors > 0) {
    console.error(`\n\x1b[31m[IconLint] Validation failed. Found ${errors} invalid texture path(s).\x1b[0m`);
    process.exit(1);
  } else {
    console.log(`\n\x1b[32m[IconLint] All ${usedIcons.size} texture paths are strictly verified!\x1b[0m`);
  }
}

if (import.meta.main) {
  validateIcons().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
