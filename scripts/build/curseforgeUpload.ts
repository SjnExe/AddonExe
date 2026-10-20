import path from 'node:path';

const projectId = '1341886';
const cfBaseUrl = 'https://minecraft-bedrock.curseforge.com';

interface CfGameVersion {
    id: number;
    gameVersionTypeID: number;
    name: string;
    slug: string;
}

function selectLatestBedrockVersion(versions: CfGameVersion[]): CfGameVersion {
    const semverCandidates = versions.filter((v) => /^\d+\.\d+/.test(v.name.trim()));
    const pool = semverCandidates.length > 0 ? semverCandidates : versions;

    const sorted = [...pool].sort((a, b) => {
        const cleanA = a.name.trim().replace(/^v/i, '');
        const cleanB = b.name.trim().replace(/^v/i, '');
        const partsA = cleanA.split('.').map((n) => Number.parseInt(n, 10) || 0);
        const partsB = cleanB.split('.').map((n) => Number.parseInt(n, 10) || 0);
        for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
            const diff = (partsA[i] ?? 0) - (partsB[i] ?? 0);
            if (diff !== 0) {
                return diff;
            }
        }
        return a.id - b.id;
    });

    return sorted[sorted.length - 1]!;
}

export async function uploadToCurseForge() {
    const token = process.env.CF_API_TOKEN;
    if (!token) {
        throw new Error('CF_API_TOKEN environment variable is required for CurseForge upload.');
    }

    const version = process.env.ARCHIVE_VERSION || (await Bun.file('package.json').json()).version;
    const addonFileName = `AddonExe.${version}.mcaddon`;
    const addonFilePath = path.resolve(process.cwd(), addonFileName);
    const addonFile = Bun.file(addonFilePath);

    if (!(await addonFile.exists())) {
        throw new Error(`Archive not found for upload: ${addonFilePath}`);
    }

    let changelog = `AddonExe v${version}`;
    const notesFile = Bun.file('release_notes.md');
    if (await notesFile.exists()) {
        changelog = await notesFile.text();
    }

    console.log('[CurseForge] Fetching available Minecraft Bedrock versions...');
    const versionsRes = await fetch(`${cfBaseUrl}/api/game/versions`, {
        headers: { 'X-Api-Token': token }
    });

    if (!versionsRes.ok) {
        throw new Error(`Failed to fetch CurseForge game versions: HTTP ${versionsRes.status} ${await versionsRes.text()}`);
    }

    const versions = (await versionsRes.json()) as CfGameVersion[];
    if (!Array.isArray(versions) || versions.length === 0) {
        throw new Error('CurseForge returned an empty game versions list.');
    }

    const latestVersion = selectLatestBedrockVersion(versions);
    console.log(`[CurseForge] Selected latest available game version: ${latestVersion.name} (ID: ${latestVersion.id})`);

    const metadata = {
        changelog,
        changelogType: 'markdown',
        displayName: `AddonExe v${version}`,
        gameVersions: [latestVersion.id],
        releaseType: 'release'
    };

    const formData = new FormData();
    formData.append('metadata', JSON.stringify(metadata));
    formData.append('file', addonFile, addonFileName);

    console.log(`[CurseForge] Uploading ${addonFileName} to project ${projectId}...`);
    const uploadRes = await fetch(`${cfBaseUrl}/api/projects/${projectId}/upload-file`, {
        method: 'POST',
        headers: { 'X-Api-Token': token },
        body: formData
    });

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
