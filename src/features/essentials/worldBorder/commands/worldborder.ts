import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import {
  getNetherBorderRadius,
  getWorldBorder,
  setEndBorder,
  setOverworldBorder,
} from '@features/essentials/worldBorder/manager.js';
import { isDefined, isNonEmptyString, isNumber } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { MinecraftDimensionTypes } from '@minecraft/vanilla-data';

function formatBorderStatus(): string {
  const cfg = getWorldBorder();
  const netherRadius = getNetherBorderRadius(cfg.overworldRadius, cfg.netherMultiplier);
  const netherCenterX = Math.floor(cfg.overworldCenterX / Math.max(1, cfg.netherMultiplier));
  const netherCenterZ = Math.floor(cfg.overworldCenterZ / Math.max(1, cfg.netherMultiplier));

  return [
    '§2--- World Border Status ---',
    `§e1. Overworld + Nether Border (1:${cfg.netherMultiplier} Linked): ${cfg.overworldEnabled ? '§aON' : '§cOFF'}`,
    `   §7Overworld Radius: §b±${cfg.overworldRadius} §7(Center: §f${cfg.overworldCenterX}, ${cfg.overworldCenterZ}§7)`,
    `   §7Nether Radius (1/${cfg.netherMultiplier}): §d±${netherRadius} §7(Center: §f${netherCenterX}, ${netherCenterZ}§7)`,
    `§e2. The End Border: ${cfg.endEnabled ? '§aON' : '§cOFF'}`,
    `   §7End Radius: §b±${cfg.endRadius} §7(Center: §f${cfg.endCenterX}, ${cfg.endCenterZ}§7)`,
    `§7Admin Bypass: ${cfg.adminBypass ? '§aEnabled' : '§cDisabled'} §8| §7Safe Buffer: §f${cfg.knockbackBuffer} blocks`,
  ].join('\n');
}

const worldborderCommand: CustomCommand = {
  name: 'worldborder',
  aliases: ['wb'],
  description: 'Manage the Overworld+Nether (8:1) and End world borders.',
  category: 'Essentials',
  permissionNode: 'cmd.worldborder.admin',
  allowConsole: true,
  parameters: [
    {
      name: 'action',
      type: 'string',
      optional: true,
      enumOptions: ['ui', 'info', 'overworld', 'end', 'on', 'off', 'set'],
    },
    { name: 'radiusOrState', type: 'string', optional: true },
    { name: 'x', type: 'float', optional: true },
    { name: 'z', type: 'float', optional: true },
  ],
  execute: async (executor: CommandExecutor, args: Record<string, unknown>) => {
    const rawAction = isNonEmptyString(args.action)
      ? args.action.toLowerCase()
      : executor instanceof mc.Player
        ? 'ui'
        : 'info';
    const secondArg = isDefined(args.radiusOrState) ? String(args.radiusOrState).trim().toLowerCase() : undefined;
    const xArg = args.x as number | undefined;
    const zArg = args.z as number | undefined;

    if (rawAction === 'ui' || rawAction === 'menu') {
      if (!(executor instanceof mc.Player)) {
        executor.sendMessage(formatBorderStatus());
        return;
      }
      const { showWorldBorderAdminPanel } = await import('@features/essentials/worldBorder/ui/panel.js');
      await showWorldBorderAdminPanel(executor);
      return;
    }

    if (rawAction === 'info' || rawAction === 'status') {
      executor.sendMessage(formatBorderStatus());
      return;
    }

    const isEndTarget =
      rawAction === 'end' ||
      ((rawAction === 'on' || rawAction === 'off' || rawAction === 'set') &&
        executor instanceof mc.Player &&
        executor.dimension.id === (MinecraftDimensionTypes.TheEnd as string));

    if (rawAction === 'on' || rawAction === 'off') {
      const enable = rawAction === 'on';
      if (isEndTarget) {
        setEndBorder(enable);
        executor.sendMessage(`§aThe End world border has been ${enable ? '§2enabled' : '§cdisabled'}§a.`);
      } else {
        const updated = setOverworldBorder(enable);
        const netherRad = getNetherBorderRadius(updated.overworldRadius, updated.netherMultiplier);
        executor.sendMessage(
          `§aOverworld + Nether world border has been ${enable ? '§2enabled' : '§cdisabled'}§a (Overworld: ±${updated.overworldRadius}, Nether: ±${netherRad}).`,
        );
      }
      return;
    }

    if (rawAction === 'set' || rawAction === 'overworld' || rawAction === 'ow' || rawAction === 'end') {
      if (secondArg === 'on' || secondArg === 'off') {
        const enable = secondArg === 'on';
        if (isEndTarget) {
          setEndBorder(enable);
          executor.sendMessage(`§aThe End world border has been ${enable ? '§2enabled' : '§cdisabled'}§a.`);
        } else {
          const updated = setOverworldBorder(enable);
          const netherRad = getNetherBorderRadius(updated.overworldRadius, updated.netherMultiplier);
          executor.sendMessage(
            `§aOverworld + Nether world border has been ${enable ? '§2enabled' : '§cdisabled'}§a (Overworld: ±${updated.overworldRadius}, Nether: ±${netherRad}).`,
          );
        }
        return;
      }

      const parsedRadius = isNonEmptyString(secondArg) ? Number.parseFloat(secondArg) : Number.NaN;
      if (Number.isNaN(parsedRadius) || parsedRadius < 16) {
        executor.sendMessage('§cUsage: /wb <overworld|end> <on|off|radius> [centerX] [centerZ]');
        return;
      }

      const cfg = getWorldBorder();
      const centerX = isNumber(xArg) ? xArg : isEndTarget ? cfg.endCenterX : cfg.overworldCenterX;
      const centerZ = isNumber(zArg) ? zArg : isEndTarget ? cfg.endCenterZ : cfg.overworldCenterZ;

      if (isEndTarget) {
        const updated = setEndBorder(true, parsedRadius, centerX, centerZ);
        executor.sendMessage(
          `§aThe End border enabled: radius §e±${updated.endRadius}§a at center (§f${updated.endCenterX}, ${updated.endCenterZ}§a).`,
        );
      } else {
        const updated = setOverworldBorder(true, parsedRadius, centerX, centerZ);
        const netherRad = getNetherBorderRadius(updated.overworldRadius, updated.netherMultiplier);
        executor.sendMessage(
          `§aOverworld + Nether border enabled: Overworld §e±${updated.overworldRadius}§a / Nether §d±${netherRad}§a (1:${updated.netherMultiplier}) at center (§f${updated.overworldCenterX}, ${updated.overworldCenterZ}§a).`,
        );
      }
      return;
    }

    executor.sendMessage('§cUsage: /wb [ui|info|overworld|end|on|off|set] [radius|on|off] [centerX] [centerZ]');
  },
};

export default worldborderCommand;
