import { beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';

import * as configManager from '@core/config/configManager.js';
import * as configurations from '@core/config/configurations.js';
import * as playerCache from '@core/data/playerCache.js';
import * as playerDataManager from '@core/data/playerDataManager.js';
import { StorageManager } from '@core/data/storageManager.js';
import {
  _clearClaimsForTest,
  canPlayerModify,
  claimChunk,
  claimRadius,
  getChunkBounds,
  getChunkKey,
  getClaim,
  getClaimsByPlayer,
  getEnforcedClaimAt,
  initializeLandClaim,
  isChunkOverlappingEndIsland,
  isChunkOverlappingSpawn,
  isClaimOwnerOrTrusted,
  toChunkCoord,
  trustPlayer,
  unclaimAll,
  unclaimChunk,
  untrustPlayer,
  updateClaimFlags,
} from '@features/essentials/protection/landclaim/manager.js';
import * as mc from '@minecraft/server';
import { MinecraftDimensionTypes, MinecraftEntityTypes } from '@minecraft/vanilla-data';

import defaultConfig from '../../../../../config.js';

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
    spyOn(playerDataManager, 'savePlayerData').mockReturnValue(true);
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

      spyOn(playerCache, 'getAllPlayersFromCache').mockReturnValue([friend]);

      claimChunk(owner, 10, 10);
      trustPlayer(owner, 'BestFriend');

      const blockLoc = { x: 165, y: 64, z: 165 };
      expect(canPlayerModify(friend, blockLoc, MinecraftDimensionTypes.Overworld, 'break')).toBe(true);
      expect(canPlayerModify(friend, blockLoc, MinecraftDimensionTypes.Overworld, 'place')).toBe(true);

      // Untrusting removes permissions
      untrustPlayer(owner, 'BestFriend');
      expect(canPlayerModify(friend, blockLoc, MinecraftDimensionTypes.Overworld, 'break')).toBe(false);
    });

    it('revokes permissions when target is offline at untrust time', () => {
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

      const cacheSpy = spyOn(playerCache, 'getAllPlayersFromCache').mockReturnValue([friend]);

      claimChunk(owner, 10, 10);
      trustPlayer(owner, 'BestFriend');

      const blockLoc = { x: 165, y: 64, z: 165 };
      expect(canPlayerModify(friend, blockLoc, MinecraftDimensionTypes.Overworld, 'break')).toBe(true);

      // Target disconnects (empty online player cache)
      cacheSpy.mockReturnValue([]);

      // Owner untrusts target by gamertag while target is offline
      untrustPlayer(owner, 'BestFriend');

      // Target reconnects; verify modification permissions remain revoked
      expect(canPlayerModify(friend, blockLoc, MinecraftDimensionTypes.Overworld, 'break')).toBe(false);
    });

    it('enforces claims only when land claim system is enabled', () => {
      const owner = {
        id: 'owner1',
        name: 'Owner',
        location: { x: 200, y: 64, z: 200 },
        dimension: { id: MinecraftDimensionTypes.Overworld },
        hasTag: () => false,
        getTags: () => [],
      } as unknown as mc.Player;

      claimChunk(owner, 10, 10);
      const loc = { x: 165, y: 64, z: 165 };

      expect(getEnforcedClaimAt(loc, MinecraftDimensionTypes.Overworld)).toBeDefined();

      landConfig.enabled = false;
      expect(getEnforcedClaimAt(loc, MinecraftDimensionTypes.Overworld)).toBeUndefined();
    });

    it('migrates legacy string trusted entries during initializeLandClaim', () => {
      spyOn(playerDataManager, 'getPlayerNameById').mockImplementation((id: string) => {
        if (id === 'legacy_id') {
          return 'LegacyPlayer';
        }
        return undefined;
      });

      const storageSpy = spyOn(StorageManager.prototype, 'load').mockReturnValue([
        {
          id: `${MinecraftDimensionTypes.Overworld}:5,5`,
          dimension: MinecraftDimensionTypes.Overworld,
          chunkX: 5,
          chunkZ: 5,
          ownerId: 'owner1',
          ownerName: 'Owner',
          claimedAt: Date.now(),
          trusted: ['legacy_id', 'UnknownPlayer'],
          flags: {},
        },
      ]);

      initializeLandClaim();

      const claim = getClaim(`${MinecraftDimensionTypes.Overworld}:5,5`);
      expect(claim).toBeDefined();
      expect(claim?.trusted).toEqual([
        { id: 'legacy_id', name: 'LegacyPlayer' },
        { id: 'UnknownPlayer', name: 'UnknownPlayer' },
      ]);

      storageSpy.mockRestore();
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

      // Reject unauthorized flag updates
      expect(updateClaimFlags(visitor, claimKey, { allowInteract: true })).toBe(false);

      // Enable visitor interact
      expect(updateClaimFlags(owner, claimKey, { allowInteract: true, allowContainers: false })).toBe(true);
      expect(canPlayerModify(visitor, blockLoc, MinecraftDimensionTypes.Overworld, 'interact')).toBe(true);
      expect(canPlayerModify(visitor, blockLoc, MinecraftDimensionTypes.Overworld, 'container')).toBe(false);

      // Enable containers
      expect(updateClaimFlags(owner, claimKey, { allowContainers: true })).toBe(true);
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

    it('unclaims chunk from a different dimension when dimensionId is explicitly passed', () => {
      const ownerInNether = {
        id: 'owner1',
        name: 'Owner',
        location: { x: 200, y: 64, z: 200 },
        dimension: { id: MinecraftDimensionTypes.Nether },
        hasTag: () => false,
        getTags: () => [],
      } as unknown as mc.Player;

      claimChunk(ownerInNether, 10, 10);
      expect(getClaimsByPlayer('owner1').length).toBe(1);

      const ownerInOverworld = {
        id: 'owner1',
        name: 'Owner',
        location: { x: 0, y: 64, z: 0 },
        dimension: { id: MinecraftDimensionTypes.Overworld },
        hasTag: () => false,
        getTags: () => [],
      } as unknown as mc.Player;

      const res = unclaimChunk(ownerInOverworld, 10, 10, MinecraftDimensionTypes.Nether);
      expect(res.success).toBe(true);
      expect(getClaimsByPlayer('owner1').length).toBe(0);
    });

    it('cancels PvP damage when victim is in a claim where PvP is disabled', () => {
      const { handleBeforeEntityHurt } = require('@core/events/protectionEvents.js');
      const owner = {
        id: 'owner1',
        name: 'Owner',
        location: { x: 165, y: 64, z: 165 },
        dimension: { id: MinecraftDimensionTypes.Overworld },
        hasTag: () => false,
        getTags: () => [],
      } as unknown as mc.Player;

      claimChunk(owner, 10, 10);

      const victim = new mc.Player('victim_p', 'Victim');
      victim.typeId = MinecraftEntityTypes.Player;
      victim.location = { x: 165, y: 64, z: 165 };
      victim.dimension = { id: MinecraftDimensionTypes.Overworld } as any;

      const attacker = new mc.Player('attacker_p', 'Attacker');
      attacker.typeId = MinecraftEntityTypes.Player;
      attacker.location = { x: 165, y: 64, z: 165 };
      attacker.dimension = { id: MinecraftDimensionTypes.Overworld } as any;

      const event = {
        hurtEntity: victim,
        damageSource: {
          damagingEntity: attacker,
          cause: mc.EntityDamageCause.entityAttack,
        },
        cancel: false,
      } as unknown as mc.EntityHurtBeforeEvent;

      handleBeforeEntityHurt(event);
      expect(event.cancel).toBe(true);
    });

    it('claims chunks with price deduction and formats receipt', () => {
      landConfig.claimCost = 100;
      const buyer = {
        id: 'buyer1',
        name: 'Buyer',
        location: { x: 320, y: 64, z: 320 },
        dimension: { id: MinecraftDimensionTypes.Overworld },
        hasTag: () => false,
        getTags: () => [],
      } as unknown as mc.Player;

      const res = claimChunk(buyer, 20, 20);
      expect(res.success).toBe(true);
      expect(res.message).toContain('Chunk [20, 20] successfully claimed for');
      expect(getClaimsByPlayer('buyer1').length).toBe(1);
    });

    it('claimRadius claims up to 9 chunks safely and skips already claimed chunks', () => {
      const radiusPlayer = {
        id: 'radius_p',
        name: 'RadiusPlayer',
        location: { x: 800, y: 64, z: 800 },
        dimension: { id: MinecraftDimensionTypes.Overworld },
        hasTag: () => false,
        getTags: () => ['landclaim.max.20'],
      } as unknown as mc.Player;

      const otherPlayer = {
        id: 'other_p',
        name: 'OtherPlayer',
        location: { x: 816, y: 64, z: 800 },
        dimension: { id: MinecraftDimensionTypes.Overworld },
        hasTag: () => false,
        getTags: () => [],
      } as unknown as mc.Player;

      // Pre-claim one chunk in that 3x3 area with otherPlayer (51, 50)
      claimChunk(otherPlayer, 51, 50);

      // radiusPlayer is at (50, 50), claims 3x3 (radius = 1)
      const res = claimRadius(radiusPlayer, 1);
      expect(res.success).toBe(true);
      // 9 chunks minus 1 already claimed by otherPlayer = 8 chunks claimed
      expect(res.claimedCount).toBe(8);

      // Verify the other player's chunk was NOT overwritten
      const otherClaim = getClaim('minecraft:overworld:51,50');
      expect(otherClaim?.ownerId).toBe('other_p');
    });

    it('respects trustFriends and trustTeam toggles in isClaimOwnerOrTrusted', () => {
      const owner = {
        id: 'team_owner',
        name: 'TeamOwner',
        location: { x: 1600, y: 64, z: 1600 },
        dimension: { id: MinecraftDimensionTypes.Overworld },
        hasTag: () => false,
        getTags: () => [],
      } as unknown as mc.Player;

      const res = claimChunk(owner, 100, 100);
      expect(res.success).toBe(true);
      const claim = res.claim!;

      const teammate = {
        id: 'teammate_p',
        name: 'Teammate',
      } as unknown as mc.Player;

      // Without trustTeam, not trusted
      expect(isClaimOwnerOrTrusted(claim, teammate)).toBe(false);

      // Update flag to trustTeam
      claim.flags.trustTeam = true;

      const teamManager = require('@features/social/team/manager.js');
      const teamSpy = spyOn(teamManager, 'getPlayerTeamId').mockImplementation((pid: string) => {
        if (pid === 'team_owner' || pid === 'teammate_p') {
          return 42;
        }
        return undefined;
      });

      expect(isClaimOwnerOrTrusted(claim, teammate)).toBe(true);
      teamSpy.mockRestore();

      // Check trustFriends
      const friend = {
        id: 'friend_p',
        name: 'Friend',
      } as unknown as mc.Player;

      claim.flags.trustFriends = true;
      const friendManager = require('@features/social/friends/manager.js');
      const friendSpy = spyOn(friendManager, 'isFriend').mockImplementation((p1: string, p2: string) => {
        return p1 === 'team_owner' && p2 === 'friend_p';
      });

      expect(isClaimOwnerOrTrusted(claim, friend)).toBe(true);
      friendSpy.mockRestore();
    });
  });
});
