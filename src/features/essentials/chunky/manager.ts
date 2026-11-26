import { StorageManager } from '@core/data/storageManager.js';
import { debugLog, errorLog, infoLog } from '@core/utils/logger.js';
import { clearTrackedInterval, setTrackedInterval } from '@core/utils/timerManager.js';
import { getCurrentTps } from '@features/sidebar/manager.js';
import * as mc from '@minecraft/server';
import { MinecraftDimensionTypes } from '@minecraft/vanilla-data';

const chunkyAreaName = 'exe_chunky';
const storage = new StorageManager('exe:chunky:v1');

/** Persisted state for an active or paused chunk pre-generation job. */
export interface ChunkyJobState {
  active: boolean;
  paused: boolean;
  dimensionId: string;
  centerChunkX: number;
  centerChunkZ: number;
  radiusChunks: number;
  stepIndex: number;
  totalChunks: number;
  startedAt: number;
}

let state: ChunkyJobState | undefined;
let intervalId: number | undefined;
let areaActive = false;

/**
 * Computes the `(dx, dz)` chunk offset for a given 0-based outward spiral index.
 *
 * @param index 0-based spiral step index.
 * @returns Chunk offset `{ dx, dz }`.
 */
export function getSpiralChunkOffset(index: number): { dx: number; dz: number } {
  if (index <= 0) {
    return { dx: 0, dz: 0 };
  }
  const k = Math.ceil((Math.sqrt(index + 1) - 1) / 2);
  let t = 2 * k + 1;
  let m = t * t;
  t -= 1;
  if (index >= m - t) {
    return { dx: k - (m - index), dz: -k };
  }
  m -= t;
  if (index >= m - t) {
    return { dx: -k, dz: -k + (m - index) };
  }
  m -= t;
  if (index >= m - t) {
    return { dx: -k + (m - index), dz: k };
  }
  return { dx: k, dz: k - (m - index - t) };
}

function saveState(): boolean {
  try {
    return storage.save(state ?? null);
  } catch (err) {
    errorLog(`[Chunky] Failed to save state: ${String(err)}`);
    return false;
  }
}

function removeChunkyTickingArea(dimensionId: string): void {
  try {
    const dim = mc.world.getDimension(dimensionId);
    dim.runCommand(`tickingarea remove ${chunkyAreaName}`);
  } catch {
    // Ignore if tickingarea does not exist
  }
  areaActive = false;
}

function stopLoop(): void {
  if (intervalId !== undefined) {
    clearTrackedInterval(intervalId);
    intervalId = undefined;
  }
}

function tickChunkyStep(): void {
  if (!state || !state.active || state.paused) {
    return;
  }

  // Adaptive TPS throttling: pause processing while server TPS is degraded
  const { tpsNum } = getCurrentTps();
  if (tpsNum < 17.0) {
    debugLog(`[Chunky] Throttling due to low TPS (${tpsNum.toFixed(1)}).`);
    return;
  }

  if (areaActive) {
    // Clean up previous temporary tickingarea after it had a tick window to load
    removeChunkyTickingArea(state.dimensionId);
  }

  if (state.stepIndex >= state.totalChunks) {
    const elapsedSec = Math.max(1, Math.round((Date.now() - state.startedAt) / 1000));
    const completed = state.totalChunks;
    state = undefined;
    saveState();
    stopLoop();
    infoLog(`[Chunky] Pre-generation complete (${completed} chunks in ${elapsedSec}s).`);
    return;
  }

  const { dx, dz } = getSpiralChunkOffset(state.stepIndex);
  const cx = state.centerChunkX + dx;
  const cz = state.centerChunkZ + dz;
  const minX = cx * 16;
  const minZ = cz * 16;
  const maxX = minX + 15;
  const maxZ = minZ + 15;

  try {
    const dim = mc.world.getDimension(state.dimensionId);
    const res = dim.runCommand(`tickingarea add ${minX} 0 ${minZ} ${maxX} 0 ${maxZ} ${chunkyAreaName} true`);
    if (res.successCount === 0) {
      return;
    }
    areaActive = true;
  } catch {
    return;
  }

  state.stepIndex += 1;
  if (state.stepIndex % 25 === 0) {
    saveState();
  }
}

function startLoop(): void {
  stopLoop();
  intervalId = setTrackedInterval(tickChunkyStep, 10);
}

/**
 * Starts a new chunk pre-generation job in an outward spiral pattern.
 *
 * @param dimensionId Target dimension identifier.
 * @param centerBlockX Center X block coordinate.
 * @param centerBlockZ Center Z block coordinate.
 * @param radiusBlocks Radius in blocks (clamped to 16..4096).
 * @returns Status message and success flag.
 */
export function startChunkyJob(
  dimensionId: string,
  centerBlockX: number,
  centerBlockZ: number,
  radiusBlocks: number,
): { success: boolean; message: string } {
  if (state?.active) {
    return { success: false, message: '§cA Chunky job is already active. Use §e/chunky cancel§c first.' };
  }
  const cleanRadius = Math.max(16, Math.min(4096, Math.floor(radiusBlocks)));
  const radiusChunks = Math.ceil(cleanRadius / 16);
  const side = radiusChunks * 2 + 1;
  const totalChunks = side * side;

  state = {
    active: true,
    paused: false,
    dimensionId: dimensionId || MinecraftDimensionTypes.Overworld,
    centerChunkX: Math.floor(centerBlockX / 16),
    centerChunkZ: Math.floor(centerBlockZ / 16),
    radiusChunks,
    stepIndex: 0,
    totalChunks,
    startedAt: Date.now(),
  };
  saveState();
  startLoop();
  return {
    success: true,
    message: `§a[Chunky] Started pre-generating §e${totalChunks} chunks§a (radius ${cleanRadius} blocks) around chunk (${state.centerChunkX}, ${state.centerChunkZ}).`,
  };
}

/**
 * Pauses the active Chunky job and removes any temporary ticking area.
 *
 * @returns Status result.
 */
export function pauseChunkyJob(): { success: boolean; message: string } {
  if (!state?.active) {
    return { success: false, message: '§7No active Chunky job.' };
  }
  if (state.paused) {
    return { success: false, message: '§eChunky job is already paused.' };
  }
  state.paused = true;
  removeChunkyTickingArea(state.dimensionId);
  saveState();
  return { success: true, message: `§e[Chunky] Paused at ${state.stepIndex}/${state.totalChunks} chunks.` };
}

/**
 * Resumes a paused Chunky job.
 *
 * @returns Status result.
 */
export function resumeChunkyJob(): { success: boolean; message: string } {
  if (!state?.active) {
    return { success: false, message: '§7No active Chunky job to resume.' };
  }
  if (!state.paused) {
    return { success: false, message: '§eChunky job is already running.' };
  }
  state.paused = false;
  saveState();
  startLoop();
  return { success: true, message: `§a[Chunky] Resumed at ${state.stepIndex}/${state.totalChunks} chunks.` };
}

/**
 * Cancels the active Chunky job and cleans up temporary ticking areas.
 *
 * @returns Status result.
 */
export function cancelChunkyJob(): { success: boolean; message: string } {
  if (!state?.active) {
    return { success: false, message: '§7No active Chunky job.' };
  }
  const dimId = state.dimensionId;
  const done = state.stepIndex;
  const total = state.totalChunks;
  state = undefined;
  stopLoop();
  removeChunkyTickingArea(dimId);
  saveState();
  return { success: true, message: `§c[Chunky] Cancelled at ${done}/${total} chunks.` };
}

/**
 * Returns the current Chunky job snapshot, if any.
 *
 * @returns Copy of the current job state or undefined.
 */
export function getChunkyStatus(): ChunkyJobState | undefined {
  return state ? { ...state } : undefined;
}

/** Initializes Chunky persistence and resumes any interrupted active job. */
export function initializeChunky(): void {
  try {
    const loaded = storage.load<ChunkyJobState | null>();
    if (loaded?.active) {
      state = loaded;
      removeChunkyTickingArea(state.dimensionId);
      if (!state.paused) {
        startLoop();
        debugLog(`[Chunky] Resumed interrupted job (${state.stepIndex}/${state.totalChunks}).`);
      }
    }
  } catch (err) {
    errorLog(`[Chunky] Failed to load state: ${String(err)}`);
  }
}

/** Resets Chunky state (for tests). */
export function _resetChunkyForTest(): void {
  stopLoop();
  state = undefined;
  areaActive = false;
}
