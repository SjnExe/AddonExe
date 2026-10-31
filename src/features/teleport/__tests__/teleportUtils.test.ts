import { beforeEach, describe, expect, it, mock } from 'bun:test';

import { MockConstructable } from '@core/__tests__/__mocks__/utils.js';
import { isSafeTeleportColumn, teleportPlayerWithTransition } from '@features/teleport/utils.js';
import * as mc from '@minecraft/server';
import { MinecraftBlockTypes } from '@minecraft/vanilla-data';

describe('teleportUtils', () => {
  const PlayerMock = mc.Player as unknown as MockConstructable<mc.Player>;
  let player: mc.Player;

  beforeEach(() => {
    player = new PlayerMock('p1', 'TestPlayer');
    player.teleport = mock();
    (player as any).camera = {
      fade: mock(),
    };
  });

  describe('teleportPlayerWithTransition', () => {
    it('should invoke player.camera.fade with default parameters when teleporting', () => {
      const targetLoc = { x: 100, y: 64, z: 200 };
      teleportPlayerWithTransition(player, targetLoc);

      expect((player as any).camera.fade).toHaveBeenCalledWith({
        fadeColor: { red: 0, green: 0, blue: 0 },
        fadeTime: { fadeInTime: 0.25, holdTime: 0.15, fadeOutTime: 0.35 },
      });
      expect(player.teleport).toHaveBeenCalledWith(targetLoc, undefined);
    });

    it('should respect custom fadeColor and fadeTime if provided', () => {
      const targetLoc = { x: 50, y: 70, z: 50 };
      teleportPlayerWithTransition(player, targetLoc, {
        fadeColor: { red: 1, green: 1, blue: 1 },
        fadeTime: { fadeInTime: 0.5, holdTime: 0.5, fadeOutTime: 0.5 },
      });

      expect((player as any).camera.fade).toHaveBeenCalledWith({
        fadeColor: { red: 1, green: 1, blue: 1 },
        fadeTime: { fadeInTime: 0.5, holdTime: 0.5, fadeOutTime: 0.5 },
      });
      expect(player.teleport).toHaveBeenCalled();
    });

    it('should skip camera fade when fadeScreen is false', () => {
      const targetLoc = { x: 10, y: 64, z: 10 };
      teleportPlayerWithTransition(player, targetLoc, { fadeScreen: false });

      expect((player as any).camera.fade).not.toHaveBeenCalled();
      expect(player.teleport).toHaveBeenCalled();
    });

    it('should safely catch errors if camera.fade throws', () => {
      (player as any).camera.fade = mock(() => {
        throw new Error('Camera disconnected');
      });
      const targetLoc = { x: 0, y: 64, z: 0 };

      expect(() => {
        teleportPlayerWithTransition(player, targetLoc);
      }).not.toThrow();
      expect(player.teleport).toHaveBeenCalled();
    });

    it('should not throw if player is invalid', () => {
      Object.defineProperty(player, 'isValid', { value: false, writable: true });
      teleportPlayerWithTransition(player, { x: 0, y: 0, z: 0 });

      expect(player.teleport).not.toHaveBeenCalled();
    });
  });

  describe('isSafeTeleportColumn', () => {
    it('returns false if any block is missing/undefined', () => {
      const dim = {
        getBlock: mock(() => undefined),
      } as unknown as mc.Dimension;

      expect(isSafeTeleportColumn(dim, 0, 64, 0)).toBe(false);
    });

    it('returns false if ground is air or liquid', () => {
      const dimAir = {
        getBlock: mock(({ y }: { y: number }) => {
          if (y === 63) {
            return { isAir: true, isLiquid: false, typeId: 'minecraft:air' };
          }
          return { isAir: true, isLiquid: false, typeId: 'minecraft:air' };
        }),
      } as unknown as mc.Dimension;
      expect(isSafeTeleportColumn(dimAir, 0, 64, 0)).toBe(false);
    });

    it('returns true for solid stone ground and air head/feet', () => {
      const dimValid = {
        getBlock: mock(({ y }: { y: number }) => {
          if (y === 63) {
            return { isAir: false, isLiquid: false, typeId: MinecraftBlockTypes.Stone };
          }
          return { isAir: true, isLiquid: false, typeId: MinecraftBlockTypes.Air };
        }),
      } as unknown as mc.Dimension;
      expect(isSafeTeleportColumn(dimValid, 0, 64, 0)).toBe(true);
    });
  });
});
