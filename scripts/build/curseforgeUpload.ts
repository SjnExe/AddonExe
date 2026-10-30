import path from 'node:path';

import { extractChangelog } from './extractChangelog.ts';

const projectId = '1341886';
const cfBaseUrl = 'https://minecraft-bedrock.curseforge.com';

export interface CfGameVersion {
  id: number;
  gameVersionTypeID: number;
  name: string;
  slug: string;
}

export function isStableBedrockVersion(v: CfGameVersion): boolean {
  const name = v.name.trim().toLowerCase();
  const slug = (v.slug || '').toLowerCase();

  // Exclude preview, beta, snapshot, pre-release and release candidate indicators
  if (/preview|beta|snapshot|pre|rc/.test(name) || /preview|beta|snapshot|pre|rc/.test(slug)) {
    return false;
  }

  // Bedrock preview versions typically contain 4 numerical components: e.g. 1.21.60.25
  if (/\b\d+\.\d+\.\d+\.\d+\b/.test(name)) {
    return false;
  }

  // Must match standard major.minor or major.minor.patch version
  return /\b\d+\.\d+(?:\.\d+)?\b/.test(name);
}

export function parseBedrockSemver(raw: string): string {
  const match = raw.match(/(?:^|\D)v?(\d+)\.(\d+)(?:\.(\d+))?/i);
  if (!match) {
    return '0.0.0';
  }
  const major = Number.parseInt(match[1]!, 10) || 0;
  const minor = Number.parseInt(match[2]!, 10) || 0;
  const patch = Number.parseInt(match[3] ?? '0', 10) || 0;
  return `${major}.${minor}.${patch}`;
}

export function selectLatestBedrockVersion(versions: CfGameVersion[], allowBeta = false): CfGameVersion | null {
  const candidates = allowBeta ? versions : versions.filter(isStableBedrockVersion);
  const pool = candidates.length > 0 ? candidates : versions;

  if (pool.length === 0) {
    return null;
  }

  const sorted = [...pool].sort((a, b) => {
    const cmp = Bun.semver.order(parseBedrockSemver(a.name), parseBedrockSemver(b.name));
    return cmp !== 0 ? cmp : a.id - b.id;
  });

  return sorted[sorted.length - 1] ?? null;
}

export function selectBedrockVersionIds(versions: CfGameVersion[], allowBeta = false): number[] {
  const latest = selectLatestBedrockVersion(versions, allowBeta);
  if (!latest) {
    return [];
  }

  const latestSemver = parseBedrockSemver(latest.name);
  const [latestMajor, latestMinor] = latestSemver.split('.').map(Number);

  // Include compatible stable versions in the same major.minor series
  const candidates = allowBeta ? versions : versions.filter(isStableBedrockVersion);
  const compatible = candidates.filter((v) => {
    const sem = parseBedrockSemver(v.name);
    const [maj, min] = sem.split('.').map(Number);
    return maj === latestMajor && min === latestMinor;
  });

  const ids = new Set<number>();
  ids.add(latest.id);
  for (const v of compatible) {
    ids.add(v.id);
  }

  return Array.from(ids);
}

async function fetchWithRetry(url: string, options: RequestInit, retries = 3, delayMs = 1500): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, options);
      if (res.ok || (res.status >= 400 && res.status < 500)) {
        return res;
      }
      console.warn(`[CurseForge] Request to ${url} returned HTTP ${res.status}. Attempt ${attempt}/${retries}.`);
    } catch (err: unknown) {
      lastError = err;
      console.warn(
        `[CurseForge] Request to ${url} failed (${attempt}/${retries}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    if (attempt < retries) {
      await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }
  throw new Error(`[CurseForge] Network request failed after ${retries} attempts: ${url}`);
}

export interface UploadOptions {
  dryRun?: boolean;
  releaseType?: 'release' | 'beta' | 'alpha';
  version?: string;
}

export async function uploadToCurseForge(opts: UploadOptions = {}) {
  const isDryRun = opts.dryRun ?? (process.argv.includes('--dry-run') || process.env.DRY_RUN === 'true');
  const token = process.env.CF_API_TOKEN;

  if (!token && !isDryRun) {
    throw new Error('CF_API_TOKEN environment variable is required for CurseForge upload.');
  }

  const version = opts.version || process.env.ARCHIVE_VERSION || (await Bun.file('package.json').json()).version;
  const addonFileName = `AddonExe.${version}.mcaddon`;
  const addonFilePath = path.resolve(process.cwd(), addonFileName);
  const addonFile = Bun.file(addonFilePath);

  if (!isDryRun && !(await addonFile.exists())) {
    throw new Error(`Archive not found for upload: ${addonFilePath}`);
  }

  // 1. Resolve release type
  let releaseType: 'release' | 'beta' | 'alpha' = opts.releaseType ?? 'release';
  if (!opts.releaseType) {
    const rawType = process.env.CF_RELEASE_TYPE?.toLowerCase();
    if (rawType === 'beta' || rawType === 'alpha') {
      releaseType = rawType;
    } else if (version.includes('-beta')) {
      releaseType = 'beta';
    } else if (version.includes('-alpha')) {
      releaseType = 'alpha';
    }
  }

  // 2. Extract curated changelog from docs/changelog.md, fallback to release_notes.md
  let changelog = await extractChangelog(version);
  if (!changelog) {
    const notesFile = Bun.file('release_notes.md');
    if (await notesFile.exists()) {
      changelog = await notesFile.text();
    }
  }
  if (!changelog || changelog.trim().length === 0) {
    changelog = `## AddonExe v${version}\n\nOfficial Bedrock release. For details, visit: https://github.com/SjnExe/AddonExe`;
  }

  // 3. Resolve game versions
  let versionIds: number[] = [];
  if (token) {
    console.log('[CurseForge] Fetching available Minecraft Bedrock versions...');
    const versionsRes = await fetchWithRetry(`${cfBaseUrl}/api/game/versions`, {
      headers: { 'X-Api-Token': token },
      signal: AbortSignal.timeout(30000),
    });

    if (!versionsRes.ok) {
      if (isDryRun) {
        console.warn(
          `[CurseForge] [DRY RUN] Could not fetch versions (HTTP ${versionsRes.status}). Using fallback ID.`,
        );
        versionIds = [1];
      } else {
        throw new Error(
          `Failed to fetch CurseForge game versions: HTTP ${versionsRes.status} ${await versionsRes.text()}`,
        );
      }
    } else {
      const versions = (await versionsRes.json()) as CfGameVersion[];
      if (!Array.isArray(versions) || versions.length === 0) {
        throw new Error('CurseForge returned an empty game versions list.');
      }

      versionIds = selectBedrockVersionIds(versions, releaseType !== 'release');
      const latestVer = selectLatestBedrockVersion(versions, releaseType !== 'release');
      console.log(
        `[CurseForge] Selected latest game version: ${latestVer?.name ?? 'unknown'} (Tagged IDs: ${versionIds.join(
          ', ',
        )})`,
      );
    }
  } else {
    console.warn('[CurseForge] [DRY RUN] No CF_API_TOKEN set. Using mock version ID [1].');
    versionIds = [1];
  }

  const metadata = {
    changelog,
    changelogType: 'markdown',
    displayName: `AddonExe v${version}`,
    gameVersions: versionIds,
    releaseType,
  };

  if (isDryRun) {
    console.log('\n================ CurseForge Upload (DRY RUN) ================');
    console.log(
      `Target File:      ${addonFilePath} (${(await addonFile.exists()) ? `${(addonFile.size / 1024).toFixed(2)} KB` : 'file missing (dry-run)'})`,
    );
    console.log(`Display Name:     ${metadata.displayName}`);
    console.log(`Release Type:     ${metadata.releaseType}`);
    console.log(`Game Version IDs: [${metadata.gameVersions.join(', ')}]`);
    console.log(`Changelog Preview (${changelog.length} chars):\n${changelog.slice(0, 300)}...`);
    console.log('=============================================================\n');
    console.log('[CurseForge] [DRY RUN] Verification successful. Upload skipped.');

    if (process.env.GITHUB_ENV) {
      const envFile = Bun.file(process.env.GITHUB_ENV);
      const existing = (await envFile.exists()) ? await envFile.text() : '';
      await Bun.write(
        process.env.GITHUB_ENV,
        `${existing}\nCF_FILE_ID=0\nCF_DOWNLOAD_URL=https://www.curseforge.com/minecraft-bedrock/addons/addonexe\n`,
      );
    }
    return;
  }

  const formData = new FormData();
  formData.append('metadata', JSON.stringify(metadata));
  formData.append('file', addonFile, addonFileName);

  console.log(`[CurseForge] Uploading ${addonFileName} to project ${projectId}...`);
  const uploadRes = await fetchWithRetry(
    `${cfBaseUrl}/api/projects/${projectId}/upload-file`,
    {
      method: 'POST',
      headers: { 'X-Api-Token': token! },
      body: formData,
      signal: AbortSignal.timeout(120000),
    },
    3,
    2000,
  );

  if (!uploadRes.ok) {
    throw new Error(`CurseForge file upload failed: HTTP ${uploadRes.status} ${await uploadRes.text()}`);
  }

  const result = (await uploadRes.json()) as { id: number };
  const downloadUrl = `https://www.curseforge.com/minecraft-bedrock/addons/addonexe/files/${result.id}`;
  console.log(`[CurseForge] Upload complete! File ID: ${result.id} -> ${downloadUrl}`);

  if (process.env.GITHUB_ENV) {
    const envFile = Bun.file(process.env.GITHUB_ENV);
    const existing = (await envFile.exists()) ? await envFile.text() : '';
    await Bun.write(process.env.GITHUB_ENV, `${existing}\nCF_FILE_ID=${result.id}\nCF_DOWNLOAD_URL=${downloadUrl}\n`);
  }
}

if (import.meta.main) {
  uploadToCurseForge().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
