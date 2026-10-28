import fs from 'node:fs/promises';
import path from 'node:path';

import { getVersionContext, parseCliArgs } from './cliUtils.ts';
import { updateManifests } from './updateManifests.ts';

const ROOT_DIR = path.resolve(import.meta.dirname, '../..');

const cliArgs = parseCliArgs(process.argv.slice(2));
const { isWatch, isRelease, isNightly, isZip, isMinify, buildNumber, customVersion } = cliArgs;

async function getVersionParts() {
  return getVersionContext(ROOT_DIR, {
    customVersion,
    isNightly,
    buildNumber,
    isRelease,
  });
}

import * as vanillaDataModule from '@minecraft/vanilla-data';

export const vanillaDataInlinerPlugin = {
  name: 'inline-vanilla-data',
  setup(build: import('bun').PluginBuilder) {
    build.onLoad({ filter: /\.(ts|js)$/ }, async (args) => {
      if (args.path.includes('node_modules') || args.path.includes('scripts/')) {
        return undefined;
      }
      const raw = await Bun.file(args.path).text();
      if (!raw.includes('@minecraft/vanilla-data')) {
        return undefined;
      }

      let modified = raw;
      const enumNames = [
        'MinecraftItemTypes',
        'MinecraftBlockTypes',
        'MinecraftEntityTypes',
        'MinecraftDimensionTypes',
        'MinecraftEffectTypes',
        'MinecraftEnchantmentTypes',
        'MinecraftBiomeTypes',
      ];

      for (const enumName of enumNames) {
        if (!modified.includes(enumName)) {
          continue;
        }
        const enumObj = (vanillaDataModule as Record<string, unknown>)[enumName] as Record<string, string> | undefined;
        if (!enumObj) {
          continue;
        }

        const dotRegex = new RegExp(`\\b${enumName}\\.([a-zA-Z0-9_]+)\\b`, 'g');
        modified = modified.replace(dotRegex, (_match, propName) => {
          if (Object.prototype.hasOwnProperty.call(enumObj, propName)) {
            return JSON.stringify(enumObj[propName]);
          }
          throw new Error(`[inline-vanilla-data] Unknown member ${enumName}.${propName} in ${args.path}`);
        });

        const bracketRegex = new RegExp(`\\b${enumName}\\[['"\\x60]([a-zA-Z0-9_]+)['"\\x60]\\]`, 'g');
        modified = modified.replace(bracketRegex, (_match, propName) => {
          if (Object.prototype.hasOwnProperty.call(enumObj, propName)) {
            return JSON.stringify(enumObj[propName]);
          }
          throw new Error(`[inline-vanilla-data] Unknown member ${enumName}["${propName}"] in ${args.path}`);
        });
      }

      // Strip unused imports of @minecraft/vanilla-data
      modified = modified.replace(/import\s*\{[^}]*\}\s*from\s*['"]@minecraft\/vanilla-data['"];?\r?\n?/g, '');

      return {
        contents: modified,
        loader: 'ts',
      };
    });
  },
};

export const commandIndexPlugin = {
  name: 'generate-command-index',
  setup(build: import('bun').PluginBuilder) {
    build.onResolve({ filter: /^virtual:command-index$/ }, (args) => {
      return {
        path: args.path,
        namespace: 'virtual-command-index',
      };
    });

    build.onLoad({ filter: /.*/, namespace: 'virtual-command-index' }, async () => {
      console.log('[Plugin] Generating virtual command index...');
      const SRC_DIR = path.resolve(ROOT_DIR, 'src');
      const FEATURES_DIR = path.join(SRC_DIR, 'features');

      const cmdGlob = new Bun.Glob('**/commands/*.ts');
      const scannedFiles = Array.from(cmdGlob.scanSync({ cwd: FEATURES_DIR, absolute: false }));
      const commandList: { varName: string; importPath: string }[] = [];

      for (const relPath of scannedFiles) {
        const normalized = relPath.replace(/\\/g, '/');
        if (normalized.endsWith('/index.ts') || normalized.includes('__tests__')) {
          continue;
        }
        if (normalized.startsWith('test/') && !isNightly) {
          continue;
        }

        const noExt = normalized.replace(/\.ts$/, '');
        const segments = noExt
          .split('/')
          .filter((seg) => seg !== 'commands')
          .map((seg) => seg.replaceAll(/[^a-zA-Z0-9]/g, ''))
          .filter(Boolean);

        const varName = 'cmd' + segments.map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join('');
        const importPath = `@features/${noExt}.js`;

        commandList.push({ varName, importPath });
      }

      commandList.sort((a, b) => a.varName.localeCompare(b.varName));
      console.log(`[Plugin] Found ${commandList.length} command files.`);

      const imports = commandList.map((cmd) => `import ${cmd.varName} from '${cmd.importPath}';`).join('\n');
      const list = commandList.map((cmd) => cmd.varName).join(',\n        ');

      const content = `// Auto-generated virtual module
import { isDefined } from '@lib/guards.js';
import { commandManager } from '@core/commands/commandManager.js';

${imports}

export function loadCommands() {
    const commandModules = [
        ${list}
    ];

    for (const mod of commandModules) {
        if (isDefined(mod)) {
            if (Array.isArray(mod)) {
                for (const cmd of mod) commandManager.register(cmd);
            } else {
                commandManager.register(mod);
            }
        }
    }
}
`;
      return {
        contents: content,
        loader: 'ts',
      };
    });
  },
};

interface PrecompressedEntry {
  dataBytes: Uint8Array;
  rawLength: number;
  crc: number;
  method: number;
}

const zipEncoder = new TextEncoder();

function prepareZipEntry(content: string | Uint8Array): PrecompressedEntry {
  const rawBytes = typeof content === 'string' ? zipEncoder.encode(content) : content;
  const crc = Bun.hash.crc32(rawBytes) >>> 0;
  const deflated = rawBytes.byteLength > 0 ? Bun.deflateSync(rawBytes, { level: 9 }) : new Uint8Array(0);
  const useDeflate = rawBytes.byteLength > 0 && deflated.byteLength < rawBytes.byteLength;
  return {
    dataBytes: useDeflate ? deflated : rawBytes,
    rawLength: rawBytes.byteLength,
    crc,
    method: useDeflate ? 8 : 0,
  };
}

async function collectPackFiles(
  sourceDir: string,
  excludeExts = ['.map', '.md'],
): Promise<Map<string, PrecompressedEntry>> {
  const entries = new Map<string, PrecompressedEntry>();
  const glob = new Bun.Glob('**/*');
  const files = Array.from(glob.scanSync({ cwd: sourceDir, absolute: false, dot: true, onlyFiles: true }));

  await Promise.all(
    files.map(async (relPath) => {
      if (excludeExts.some((ext) => relPath.endsWith(ext))) {
        return;
      }
      const fullPath = path.join(sourceDir, relPath);
      const normalizedPath = relPath.replace(/\\/g, '/');

      if (relPath.endsWith('.json')) {
        try {
          const parsedJson = await Bun.file(fullPath).json();
          entries.set(normalizedPath, prepareZipEntry(JSON.stringify(parsedJson)));
          return;
        } catch {
          // Fall back to raw content if JSON parsing fails
        }
      }
      if (relPath.endsWith('.lang')) {
        const rawLang = await Bun.file(fullPath).text();
        const minLang = rawLang
          .split(/\r?\n/)
          .filter((line) => {
            const t = line.trim();
            return t.length > 0 && !t.startsWith('#');
          })
          .join('\n');
        entries.set(normalizedPath, prepareZipEntry(minLang));
        return;
      }

      entries.set(normalizedPath, prepareZipEntry(await Bun.file(fullPath).bytes()));
    }),
  );

  return entries;
}

function buildZipArchive(entries: Map<string, PrecompressedEntry>): Uint8Array {
  const localChunks: Uint8Array[] = [];
  const centralChunks: Uint8Array[] = [];
  let localOffset = 0;
  let centralSize = 0;

  for (const [zipPath, entry] of entries) {
    const nameBytes = zipEncoder.encode(zipPath);
    const { dataBytes, rawLength, crc, method } = entry;

    const localHeader = new Uint8Array(30 + nameBytes.byteLength);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, method, true);
    localView.setUint16(10, 0, true);
    localView.setUint16(12, 0x0021, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, dataBytes.byteLength, true);
    localView.setUint32(22, rawLength, true);
    localView.setUint16(26, nameBytes.byteLength, true);
    localView.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    localChunks.push(localHeader, dataBytes);

    const centralHeader = new Uint8Array(46 + nameBytes.byteLength);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, method, true);
    centralView.setUint16(12, 0, true);
    centralView.setUint16(14, 0x0021, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, dataBytes.byteLength, true);
    centralView.setUint32(24, rawLength, true);
    centralView.setUint16(28, nameBytes.byteLength, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, localOffset, true);
    centralHeader.set(nameBytes, 46);

    centralChunks.push(centralHeader);
    localOffset += localHeader.byteLength + dataBytes.byteLength;
    centralSize += centralHeader.byteLength;
  }

  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, 0x06054b50, true);
  eocdView.setUint16(4, 0, true);
  eocdView.setUint16(6, 0, true);
  eocdView.setUint16(8, entries.size, true);
  eocdView.setUint16(10, entries.size, true);
  eocdView.setUint32(12, centralSize, true);
  eocdView.setUint32(16, localOffset, true);
  eocdView.setUint16(20, 0, true);

  const totalSize = localOffset + centralSize + 22;
  const output = new Uint8Array(totalSize);
  let offset = 0;
  for (const chunk of localChunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  for (const chunk of centralChunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  output.set(eocd, offset);
  return output;
}

async function createArchives(versionStr: string) {
  console.log(`[Build] Creating release archives (${versionStr})...`);

  const packsDir = path.resolve(ROOT_DIR, 'packs');
  const behaviorDir = path.join(packsDir, 'behavior');
  const resourceDir = path.join(packsDir, 'resource');

  const [bpEntries, rpEntries] = await Promise.all([collectPackFiles(behaviorDir), collectPackFiles(resourceDir)]);

  const bedrockLocales = [
    'en_US',
    'en_GB',
    'de_DE',
    'es_ES',
    'es_MX',
    'fr_FR',
    'fr_CA',
    'it_IT',
    'ja_JP',
    'ko_KR',
    'pt_BR',
    'pt_PT',
    'ru_RU',
    'zh_CN',
    'zh_TW',
    'nl_NL',
    'bg_BG',
    'cs_CZ',
    'da_DK',
    'el_GR',
    'fi_FI',
    'hu_HU',
    'id_ID',
    'nb_NO',
    'pl_PL',
    'sk_SK',
    'sv_SE',
    'tr_TR',
    'uk_UA',
  ];
  const joinLeaveSuppression = [
    'multiplayer.player.joined=',
    'multiplayer.player.left=',
    'multiplayer.player.joined.renamed=',
    'multiplayer.player.left.renamed=',
  ].join('\n');
  rpEntries.set('texts/languages.json', prepareZipEntry(JSON.stringify(bedrockLocales)));
  for (const locale of bedrockLocales) {
    const langPath = `texts/${locale}.lang`;
    if (!rpEntries.has(langPath)) {
      rpEntries.set(langPath, prepareZipEntry(joinLeaveSuppression));
    }
  }

  const mcaddonEntries = new Map<string, PrecompressedEntry>();
  for (const [relPath, content] of bpEntries) {
    mcaddonEntries.set(`behavior/${relPath}`, content);
  }
  for (const [relPath, content] of rpEntries) {
    mcaddonEntries.set(`resource/${relPath}`, content);
  }

  const mcaddonPath = path.resolve(ROOT_DIR, `AddonExe.${versionStr}.mcaddon`);
  const bpPath = path.resolve(ROOT_DIR, `AddonExe_BP.${versionStr}.mcpack`);
  const rpPath = path.resolve(ROOT_DIR, `AddonExe_RP.${versionStr}.mcpack`);

  const mcaddonData = buildZipArchive(mcaddonEntries);
  const bpData = buildZipArchive(bpEntries);
  const rpData = buildZipArchive(rpEntries);

  await Promise.all([Bun.write(mcaddonPath, mcaddonData), Bun.write(bpPath, bpData), Bun.write(rpPath, rpData)]);

  console.log(`[Build] Archives generated successfully:`);
  console.log(`  - ${path.basename(mcaddonPath)}`);
  console.log(`  - ${path.basename(bpPath)}`);
  console.log(`  - ${path.basename(rpPath)}`);
}

async function compileScripts(_versionArray: number[], versionStr: string, outDirSuffix: string = '') {
  console.log(`[Build] Compiling Scripts...`);

  const coreEntrypoints = ['src/main.ts'];
  const outDir = path.resolve(ROOT_DIR, `packs/behavior/scripts${outDirSuffix}`);

  const externalModules = ['@minecraft/server', '@minecraft/server-ui'];

  // Bundle Core Engine Module into main.js
  const coreResult = await Bun.build({
    entrypoints: coreEntrypoints,
    outdir: outDir,
    root: './src',
    target: 'browser',
    format: 'esm',
    env: 'disable',
    minify:
      isMinify || isRelease
        ? { whitespace: true, identifiers: true, syntax: true }
        : { whitespace: false, identifiers: false, syntax: true },
    treeShaking: true,
    sourcemap: process.argv.includes('--sourcemap') || cliArgs.sourcemap ? 'external' : 'none',
    drop: isRelease ? ['debugger', 'console'] : isMinify ? ['debugger'] : [],
    splitting: false,
    allowUnresolved: [],
    metafile: process.argv.includes('--analyze') ? { markdown: 'bundle-meta.md' } : true,
    noDeprecatedNamespaceObjectSetters: true,
    naming: '[dir]/[name].[ext]',
    define: {
      __IS_NIGHTLY__: String(isNightly),
      __VERSION__: JSON.stringify(versionStr),
      __DEV__: JSON.stringify(!isRelease),
    },
    plugins: [commandIndexPlugin, vanillaDataInlinerPlugin],
    external: externalModules,
  });

  if (!coreResult.success) {
    console.error(`[Build] Core script compilation failed:`);
    for (const msg of coreResult.logs) {
      console.error(msg);
    }
    process.exit(1);
  }

  const inputCount = coreResult.metafile ? Object.keys(coreResult.metafile.inputs).length : 0;
  const outputBytes = coreResult.outputs[0]?.size ?? 0;
  const sizeKb = (outputBytes / 1024).toFixed(2);
  console.log(`[Build] Scripts compiled successfully (${inputCount} modules -> ${sizeKb} KB main.js).`);

  if (process.argv.includes('--analyze')) {
    const mdFile = Bun.file(path.resolve(ROOT_DIR, 'bundle-meta.md'));
    if (await mdFile.exists()) {
      const mdText = await mdFile.text();
      console.log('\n' + mdText.trim() + '\n');
    } else if (coreResult.metafile) {
      const outputEntries = Object.entries(coreResult.metafile.outputs);
      const mainOutput = outputEntries.find(([outPath]) => outPath.endsWith('main.js'))?.[1] ?? outputEntries[0]?.[1];
      const bundledInputs = mainOutput?.inputs ?? {};
      const sorted = Object.entries(bundledInputs)
        .map(([modPath, info]) => ({
          path: modPath.replace(/^node_modules\/\.bun\/[^/]+\/node_modules\//, 'node_modules/'),
          bytes: info.bytesInOutput,
        }))
        .filter((m) => m.bytes > 0)
        .sort((a, b) => b.bytes - a.bytes);
      const totalBundled = sorted.reduce((acc, m) => acc + m.bytes, 0) || outputBytes || 1;
      console.log(`\n📊 Bundled Modules Breakdown (${sorted.length} modules -> ${sizeKb} KB):`);
      for (const item of sorted) {
        const pct = ((item.bytes / totalBundled) * 100).toFixed(1).padStart(5);
        console.log(`  ${(item.bytes / 1024).toFixed(2).padStart(7)} KB (${pct}%)  ${item.path}`);
      }
      console.log('');
    }
  }
}

async function main() {
  console.log('--- Starting Build Pipeline ---');

  await updateManifests(cliArgs);

  const { versionStr, versionArray } = await getVersionParts();

  if (isNightly) {
    console.log('[Build] Mode: Nightly Build');
  } else if (isRelease) {
    console.log('[Build] Mode: Public Release');
  } else {
    console.log('[Build] Mode: Local Build');
  }
  console.log(`[Build] Version Resolved: ${versionStr} -> [${versionArray.join(', ')}]`);

  await compileScripts(versionArray, versionStr, '');

  if (isZip) {
    await createArchives(versionStr);
  }

  const buildMetaContent = [
    `BUILD_TYPE=${isRelease ? 'stable' : isNightly ? 'nightly' : 'local'}`,
    `ARCHIVE_VERSION=${versionStr}`,
    `VERSION_STRING=${versionStr}`,
    `BUILD_DATE=${new Date().toUTCString()}`,
    `PREFIX=${isRelease ? 'Release' : isNightly ? 'Nightly' : 'Local'}`,
  ].join('\n');
  await Bun.write(path.resolve(ROOT_DIR, 'build_meta.env'), buildMetaContent);

  console.log('--- Build Complete ---');

  if (isWatch) {
    console.log('[Watch] Watching for file changes...');
    let buildTimeout: any = null;
    const debounceBuild = () => {
      if (buildTimeout) {
        clearTimeout(buildTimeout);
      }
      buildTimeout = setTimeout(async () => {
        console.log('[Watch] Change detected, rebuilding...');
        try {
          await compileScripts(versionArray, versionStr, '');
          console.log('[Watch] Rebuild complete.');
        } catch (e: any) {
          console.error(`[Watch] Rebuild failed: ${e.message}`);
        }
      }, 300);
    };

    const watchDir = async (dir: string) => {
      try {
        const watcher = fs.watch(dir, { recursive: true });
        for await (const event of watcher) {
          if (
            event.filename &&
            !event.filename.startsWith('packs') &&
            !event.filename.startsWith('.git') &&
            !event.filename.startsWith('node_modules')
          ) {
            debounceBuild();
          }
        }
      } catch (err) {
        console.warn(`[Watch] Error watching ${dir}:`, err);
      }
    };

    watchDir(path.resolve(ROOT_DIR, 'src'));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
