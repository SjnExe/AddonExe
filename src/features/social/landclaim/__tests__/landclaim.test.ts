import { beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';

import * as configManager from '@core/config/configManager.js';
import * as configurations from '@core/config/configurations.js';
import * as playerDataManager from '@core/data/playerDataManager.js';
import {
  _clearClaimsForTest,
  canPlayerModify,
  claimChunk,
  getChunkBounds,
  getChunkKey,
  getClaimsByPlayer,
  initializeLandClaim,
  isChunkOverlappingEndIsland,
  isChunkOverlappingSpawn,
  toChunkCoord,
  trustPlayer,
  unclaimAll,
  unclaimChunk,
  untrustPlayer,
  updateClaimFlags,
} from '@features/social/landclaim/manager.js';
import * as mc from '@minecraft/server';
import { MinecraftDimensionTypes } from '@minecraft/vanilla-data';

import defaultConfig from '../../../../config.js';

describe('Land Claim System', () => {
  let landConfig = {
    enabled: true,
    maxClaimsPerPlayer: 3,
    claimCost: 0,
    allowNether: true,
    allowTheEnd: true,
    endIslandProtectedRadius: 300,
    preventExplosionsDefault: true,
    preventPvPDefault: true,
    preventMobGriefingDefault: true,
    visualizerDurationSeconds: 15,
  };

  let playerBalance = 1000;

  beforeEach(() => {
    _clearClaimsForTest();
    initializeLandClaim();

    landConfig = {
      enabled: true,
      maxClaimsPerPlayer: 3,
      claimCost: 0,
      allowNether: true,
      allowTheEnd: true,
      endIslandProtectedRadius: 300,
      preventExplosionsDefault: true,
      preventPvPDefault: true,
      preventMobGriefingDefault: true,
      visualizerDurationSeconds: 15,
    };

    playerBalance = 1000;

    spyOn(configurations, 'getLandClaimConfig').mockImplementation(() => landConfig as any);
    spyOn(configManager, 'getConfig').mockReturnValue({
      ...defaultConfig,
      spawn: {
        ...defaultConfig.spawn,
        spawnLocation: {
          x: 0,
          y: 64,
          z: 0,
          dimensionId: MinecraftDimensionTypes.Overworld,
        },
      },
      spawnProtection: {
        ...defaultConfig.spawnProtection,
        enabled: true,
        protectionRadius: 50,
        allowAdminBypass: true,
      },
    } as any);

    spyOn(playerDataManager, 'getBalance').mockImplementation(() => playerBalance);
    spyOn(playerDataManager, 'incrementPlayerBalance').mockImplementation((_pid: string, amt: number) => {
      playerBalance += amt;
    });
  });

  describe('Chunk Coordinates & Math', () => {
    it('correctly maps block coordinates to chunk coordinates', () => {
      expect(toChunkCoord(0)).toBe(0);
      expect(toChunkCoord(15)).toBe(0);
      expect(toChunkCoord(16)).toBe(1);
      expect(toChunkCoord(-1)).toBe(-1);
      expect(toChunkCoord(-16)).toBe(-1);
      expect(toChunkCoord(-17)).toBe(-2);
    });

    it('generates consistent chunk keys', () => {
      expect(getChunkKey(MinecraftDimensionTypes.Overworld, 5, -3)).toBe('minecraft:overworld:5,-3');
    });

    it('calculates bounding box accurately', () => {
      const bounds = getChunkBounds(2, -1);
      expect(bounds.minX).toBe(32);
      expect(bounds.maxX).toBe(47);
      expect(bounds.minZ).toBe(-16);
      expect(bounds.maxZ).toBe(-1);
    });
  });

  describe('Safety & Spawn Invariants', () => {
    it('detects chunk overlap with spawn area', () => {
      // Spawn is (0, 0), radius 50 (from -50 to +50)
      // Chunk 0 (0 to 15) is inside spawn
      expect(isChunkOverlappingSpawn(MinecraftDimensionTypes.Overworld, 0, 0)).toBe(true);
      // Chunk 3 (48 to 63) overlaps spawn boundary at 50
      expect(isChunkOverlappingSpawn(MinecraftDimensionTypes.Overworld, 3, 0)).toBe(true);
      // Chunk 4 (64 to 79) is completely outside spawn
      expect(isChunkOverlappingSpawn(MinecraftDimensionTypes.Overworld, 4, 0)).toBe(false);
      // Nether chunk at (0, 0) does not overlap Overworld spawn
      expect(isChunkOverlappingSpawn(MinecraftDimensionTypes.Nether, 0, 0)).toBe(false);
    });

    it('strictly guards central End Island from claiming', () => {
      // End Island safe radius = 300
      // Chunk 0, 0 is at the center of the End
      expect(isChunkOverlappingEndIsland(MinecraftDimensionTypes.TheEnd, 0, 0, 300)).toBe(true);
      // Chunk 10, 10 (160 to 175) is within 300 radius
      expect(isChunkOverlappingEndIsland(MinecraftDimensionTypes.TheEnd, 10, 10, 300)).toBe(true);
      // Chunk 20, 0 (320 to 335) is safely outside 300 radius
      expect(isChunkOverlappingEndIsland(MinecraftDimensionTypes.TheEnd, 20, 0, 300)).toBe(false);
      // Overworld chunk at (0, 0) is not End Island
      expect(isChunkOverlappingEndIsland(MinecraftDimensionTypes.Overworld, 0, 0, 300)).toBe(false);
    });

    it('rejects claiming inside spawn area for regular players', () => {
      const player = {
        id: 'p1',
        name: 'Player1',
        location: { x: 0, y: 64, z: 0 },
        dimension: { id: MinecraftDimensionTypes.Overworld },
        hasTag: () => false,
        getTags: () => [],
      } as unknown as mc.Player;

      const res = claimChunk(player, 0, 0);
      expect(res.success).toBe(false);
      expect(res.message).toContain('spawn area');
    });

    it('rejects claiming on central End Island even when allowTheEnd is enabled', () => {
      const player = {
        id: 'p1',
        name: 'Player1',
        location: { x: 0, y: 64, z: 0 },
        dimension: { id: MinecraftDimensionTypes.TheEnd },
        hasTag: () => false,
        getTags: () => [],
      } as unknown as mc.Player;

      const res = claimChunk(player, 0, 0);
      expect(res.success).toBe(false);
      expect(res.message).toContain('central End island');
    });

    it('respects dimension toggles when Nether or End is disabled', () => {
      landConfig.allowNether = false;
      const player = {
        id: 'p1',
        name: 'Player1',
        location: { x: 160, y: 64, z: 160 },
        dimension: { id: MinecraftDimensionTypes.Nether },
        hasTag: () => false,
        getTags: () => [],
      } as unknown as mc.Player;

      const res = claimChunk(player, 10, 10);
      expect(res.success).toBe(false);
      expect(res.message).toContain('Nether');
    });
  });

  describe('Claim Limits & Economy', () => {
    it('enforces maximum claims per player', () => {
      const player = {
        id: 'p1',
        name: 'Player1',
        location: { x: 200, y: 64, z: 200 },
        dimension: { id: MinecraftDimensionTypes.Overworld },
        hasTag: () => false,
        getTags: () => [],
      } as unknown as mc.Player;

      expect(claimChunk(player, 10, 10).success).toBe(true);
      expect(claimChunk(player, 11, 10).success).toBe(true);
      expect(claimChunk(player, 12, 10).success).toBe(true);

      // 4th claim exceeds max of 3
      const fourth = claimChunk(player, 13, 10);
      expect(fourth.success).toBe(false);
      expect(fourth.message).toContain('claim limit');
    });

    it('charges claim cost if configured and rejects on insufficient funds', () => {
      landConfig.claimCost = 600;
      const player = {
        id: 'p1',
        name: 'Player1',
        location: { x: 200, y: 64, z: 200 },
        dimension: { id: MinecraftDimensionTypes.Overworld },
        hasTag: () => false,
        getTags: () => [],
      } as unknown as mc.Player;

      // First claim succeeds and subtracts 600
      expect(claimChunk(player, 10, 10).success).toBe(true);
      expect(playerBalance).toBe(400);

      // Second claim requires 600 but balance is 400
      const second = claimChunk(player, 11, 10);
      expect(second.success).toBe(false);
      expect(second.message).toContain('Insufficient funds');
    });
  });

  describe('Trust & Modification Permissions', () => {
    it('allows owner to modify and blocks unauthorized visitors', () => {
      const owner = {
        id: 'owner1',
        name: 'Owner',
        location: { x: 200, y: 64, z: 200 },
        dimension: { id: MinecraftDimensionTypes.Overworld },
        hasTag: () => false,
        getTags: () => [],
      } as unknown as mc.Player;

      const visitor = {
        id: 'visitor1',
        name: 'Stranger',
        location: { x: 200, y: 64, z: 200 },
        dimension: { id: MinecraftDimensionTypes.Overworld },
        hasTag: () => false,
        getTags: () => [],
      } as unknown as mc.Player;

      claimChunk(owner, 10, 10);

      const blockLoc = { x: 165, y: 64, z: 165 };
      expect(canPlayerModify(owner, blockLoc, MinecraftDimensionTypes.Overworld, 'break')).toBe(true);
      expect(canPlayerModify(owner, blockLoc, MinecraftDimensionTypes.Overworld, 'place')).toBe(true);

      expect(canPlayerModify(visitor, blockLoc, MinecraftDimensionTypes.Overworld, 'break')).toBe(false);
      expect(canPlayerModify(visitor, blockLoc, MinecraftDimensionTypes.Overworld, 'place')).toBe(false);
      expect(canPlayerModify(visitor, blockLoc, MinecraftDimensionTypes.Overworld, 'container')).toBe(false);
      expect(canPlayerModify(visitor, blockLoc, MinecraftDimensionTypes.Overworld, 'interact')).toBe(false);
    });

    it('allows trusted player to build and break', () => {
      const owner = {
        id: 'owner1',
        name: 'Owner',
        location: { x: 200, y: 64, z: 200 },
        dimension: { id: MinecraftDimensionTypes.Overworld },
        hasTag: () => false,
        getTags: () => [],
      } as unknown as mc.Player;

      const friend = {
        id: 'friend1',
        name: 'BestFriend',
        location: { x: 200, y: 64, z: 200 },
        dimension: { id: MinecraftDimensionTypes.Overworld },
        hasTag: () => false,
        getTags: () => [],
      } as unknown as mc.Player;

      claimChunk(owner, 10, 10);
      trustPlayer(owner, 'BestFriend');

      const blockLoc = { x: 165, y: 64, z: 165 };
      expect(canPlayerModify(friend, blockLoc, MinecraftDimensionTypes.Overworld, 'break')).toBe(true);
      expect(canPlayerModify(friend, blockLoc, MinecraftDimensionTypes.Overworld, 'place')).toBe(true);

      // Untrusting removes permissions
      untrustPlayer(owner, 'BestFriend');
      expect(canPlayerModify(friend, blockLoc, MinecraftDimensionTypes.Overworld, 'break')).toBe(false);
    });

    it('respects visitor interact and container flags', () => {
      const owner = {
        id: 'owner1',
        name: 'Owner',
        location: { x: 200, y: 64, z: 200 },
        dimension: { id: MinecraftDimensionTypes.Overworld },
        hasTag: () => false,
        getTags: () => [],
      } as unknown as mc.Player;

      const visitor = {
        id: 'visitor1',
        name: 'Stranger',
        location: { x: 200, y: 64, z: 200 },
        dimension: { id: MinecraftDimensionTypes.Overworld },
        hasTag: () => false,
        getTags: () => [],
      } as unknown as mc.Player;

      const res = claimChunk(owner, 10, 10);
      const claimKey = res.claim!.id;

      const blockLoc = { x: 165, y: 64, z: 165 };

      // Enable visitor interact
      updateClaimFlags(claimKey, { allowInteract: true, allowContainers: false });
      expect(canPlayerModify(visitor, blockLoc, MinecraftDimensionTypes.Overworld, 'interact')).toBe(true);
      expect(canPlayerModify(visitor, blockLoc, MinecraftDimensionTypes.Overworld, 'container')).toBe(false);

      // Enable containers
      updateClaimFlags(claimKey, { allowContainers: true });
      expect(canPlayerModify(visitor, blockLoc, MinecraftDimensionTypes.Overworld, 'container')).toBe(true);
    });
  });

  describe('Unclaiming & Cleanup', () => {
    it('unclaims single chunk and decrements claim count', () => {
      const owner = {
        id: 'owner1',
        name: 'Owner',
        location: { x: 200, y: 64, z: 200 },
        dimension: { id: MinecraftDimensionTypes.Overworld },
        hasTag: () => false,
        getTags: () => [],
      } as unknown as mc.Player;

      claimChunk(owner, 10, 10);
      expect(getClaimsByPlayer('owner1').length).toBe(1);

      const unclaimRes = unclaimChunk(owner, 10, 10);
      expect(unclaimRes.success).toBe(true);
      expect(getClaimsByPlayer('owner1').length).toBe(0);
    });

    it('unclaimAll releases all player claims', () => {
      const owner = {
        id: 'owner1',
        name: 'Owner',
        location: { x: 200, y: 64, z: 200 },
        dimension: { id: MinecraftDimensionTypes.Overworld },
        hasTag: () => false,
        getTags: () => [],
      } as unknown as mc.Player;

      claimChunk(owner, 10, 10);
      claimChunk(owner, 11, 10);
      expect(getClaimsByPlayer('owner1').length).toBe(2);

      const res = unclaimAll(owner);
      expect(res.success).toBe(true);
      expect(getClaimsByPlayer('owner1').length).toBe(0);
    });
  });
});
