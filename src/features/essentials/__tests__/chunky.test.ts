import { afterEach, beforeEach, describe, expect, it } from 'bun:test';

import {
  _resetChunkyForTest,
  cancelChunkyJob,
  getChunkyStatus,
  getSpiralChunkOffset,
  pauseChunkyJob,
  resumeChunkyJob,
  startChunkyJob,
} from '@features/essentials/chunky/manager.js';
import { MinecraftDimensionTypes } from '@minecraft/vanilla-data';

describe('Chunky Chunk Pre-Generator', () => {
  beforeEach(() => {
    _resetChunkyForTest();
  });

  afterEach(() => {
    _resetChunkyForTest();
  });

  it('generates unique outward spiral coordinates from origin', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 25; i++) {
      const { dx, dz } = getSpiralChunkOffset(i);
      seen.add(`${dx},${dz}`);
    }
    expect(getSpiralChunkOffset(0)).toEqual({ dx: 0, dz: 0 });
    expect(seen.size).toBe(25);
  });

  it('starts, pauses, resumes, and cancels a pre-generation job', () => {
    const startRes = startChunkyJob(MinecraftDimensionTypes.Overworld, 0, 0, 32);
    expect(startRes.success).toBe(true);
    expect(getChunkyStatus()?.totalChunks).toBe(25);

    const dupRes = startChunkyJob(MinecraftDimensionTypes.Overworld, 0, 0, 32);
    expect(dupRes.success).toBe(false);

    expect(pauseChunkyJob().success).toBe(true);
    expect(getChunkyStatus()?.paused).toBe(true);

    expect(resumeChunkyJob().success).toBe(true);
    expect(getChunkyStatus()?.paused).toBe(false);

    expect(cancelChunkyJob().success).toBe(true);
    expect(getChunkyStatus()).toBeUndefined();
  });
});
