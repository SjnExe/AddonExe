import { getConfig, updateConfig } from '@core/config/configManager.js';
import { getWorldProtectionConfig, saveWorldProtectionConfig } from '@core/config/configurations.js';
import { showPanel } from '@core/ui/uiManager.js';
import { clearProtectionAuditLogs, getAuditLogsNear } from '@features/essentials/protection/auditLog.js';
import { WorldProtectionZone } from '@features/essentials/protection/config.js';
import {
  getZoneSelection,
  giveZoneSelectionWand,
  previewZoneBoundaryParticles,
  setZoneSelectionPos,
} from '@features/essentials/protection/zoneSelectionManager.js';
import { isDefined } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { MinecraftDimensionTypes } from '@minecraft/vanilla-data';
import { ActionFormBuilder } from '@ui/builders/actionFormBuilder.js';
import { CustomFormBuilder } from '@ui/builders/customFormBuilder.js';

/**
 * Displays the centralized World & Spawn Protection Hub UI.
 *
 * @param player The staff member viewing the panel.
 * @param context Navigation context passed between panels.
 */
export async function showWorldProtectionListPanel(
  player: mc.Player,
  context: Record<string, unknown> = {},
): Promise<void> {
  const config = getWorldProtectionConfig();
  const form = new ActionFormBuilder().title('World Protection Zones');

  const sel = getZoneSelection(player.id);
  const p1Str = isDefined(sel?.pos1) ? `${sel.pos1.x} ${sel.pos1.y} ${sel.pos1.z}` : 'Unset';
  const p2Str = isDefined(sel?.pos2) ? `${sel.pos2.x} ${sel.pos2.y} ${sel.pos2.z}` : 'Unset';
  form.body(`§7Wand Selection — §bPos1: §f${p1Str} §8| §ePos2: §f${p2Str}`);

  form.button('§l§6Global World Rules\n§r§7PvP, explosions, mob griefing, audit log', 'textures/ui/World', async () => {
    await showGlobalProtectionRulesPanel(player, context);
  });

  form.button(
    '§l§bSpawn Protection Settings\n§r§7Radius, bypass, and spawn flags',
    'textures/ui/icon_recipe_equipment',
    async () => {
      await showSpawnProtectionQuickPanel(player, context);
    },
  );

  if (config.auditLog?.enabled) {
    form.button(
      '§l§eInspect Nearby Audit Logs\n§r§7Recent breaks/places/containers (8m)',
      'textures/ui/magnifyingGlass',
      async () => {
        await showNearbyAuditLogsPanel(player, context);
      },
    );
  }

  form.button('§l§2+ Add New Zone\n§r§7Uses wand Pos1/Pos2 if set', 'textures/ui/color_plus', async () => {
    await showPanel(player, 'addWorldProtectionPanel', { ...context, page: 1 });
  });

  form.button('§l§dGet Selection Wand\n§r§7Break=Pos1, Interact=Pos2', 'textures/items/gold_axe', async () => {
    giveZoneSelectionWand(player);
  });

  form.button('§bSet Pos1 at My Feet', 'textures/ui/icon_map', async () => {
    setZoneSelectionPos(player, 'pos1', player.location);
    await showWorldProtectionListPanel(player, context);
  });

  form.button('§eSet Pos2 at My Feet', 'textures/ui/icon_map', async () => {
    setZoneSelectionPos(player, 'pos2', player.location);
    await showWorldProtectionListPanel(player, context);
  });

  config.zones.forEach((zone) => {
    form.button(zone.name, 'textures/ui/icon_recipe_nature', async () => {
      await showPanel(player, 'editWorldProtectionPanel', {
        ...context,
        page: 1,
        selectedItemId: `zone_${zone.id}`,
      });
    });
  });

  form.addBackButton(async () => {
    await showPanel(player, 'staffWorldHub', context);
  });

  await form.show(player);
}

export async function showAddWorldProtectionPanel(
  player: mc.Player,
  context: Record<string, unknown> = {},
): Promise<void> {
  await handleWorldProtectionForm(player, false, context);
}

export async function showEditWorldProtectionPanel(player: mc.Player, context: Record<string, unknown>): Promise<void> {
  await handleWorldProtectionForm(player, true, context);
}

type WorldProtectionFormVals = {
  id: string;
  name: string;
  dimension: string;
  pos1: string;
  pos2: string;
  preventPvP: boolean;
  preventHostileDamage: boolean;
  preventHostileMobSpawning: boolean;
  preventBlockBreaking: boolean;
  preventBlockPlacing: boolean;
  preventExplosions: boolean;
  preventBlockInteraction: boolean;
  preventItemPickup: boolean;
  preventFallDamage: boolean;
  preventMagicDamage: boolean;
  preventMobGriefing: boolean;
  preventEntityInteraction: boolean;
  preventProjectileUsage: boolean;
  previewParticles?: boolean;
  isDelete?: boolean;
};

async function handleWorldProtectionForm(
  player: mc.Player,
  isEdit: boolean,
  context: Record<string, unknown>,
): Promise<void> {
  const config = getWorldProtectionConfig();
  let zone: WorldProtectionZone | undefined;

  if (isEdit && (context.selectedItemId as string)) {
    const zoneId = (context.selectedItemId as string).replace('zone_', '');
    zone = config.zones.find((z) => z.id === zoneId);
    if (!zone) {
      return showWorldProtectionListPanel(player, context);
    }
  }

  const form = new CustomFormBuilder<WorldProtectionFormVals>(
    isEdit ? `Edit Zone: ${zone?.name}` : 'Add Protection Zone',
  );

  form.textField('id', 'Zone ID/Name (No spaces recommended)', 'e.g., spawn_city', zone?.id ?? '');
  form.textField('name', 'Display Name', 'e.g., Spawn City', zone?.name ?? '');

  const dimensions = [
    MinecraftDimensionTypes.Overworld,
    MinecraftDimensionTypes.Nether,
    MinecraftDimensionTypes.TheEnd,
  ];
  const dimIndex = zone ? Math.max(0, dimensions.indexOf(zone.dimension as MinecraftDimensionTypes)) : 0;
  form.dropdown('dimension', 'Dimension', dimensions, dimIndex);

  const wandSel = getZoneSelection(player.id);
  const wandPos1 = isDefined(wandSel?.pos1) ? `${wandSel.pos1.x} ${wandSel.pos1.y} ${wandSel.pos1.z}` : '';
  const wandPos2 = isDefined(wandSel?.pos2) ? `${wandSel.pos2.x} ${wandSel.pos2.y} ${wandSel.pos2.z}` : '';
  const defPos1 = zone ? `${zone.box.min.x} ${zone.box.min.y} ${zone.box.min.z}` : wandPos1;
  const defPos2 = zone ? `${zone.box.max.x} ${zone.box.max.y} ${zone.box.max.z}` : wandPos2;

  form.textField('pos1', 'Position 1 (x y z)', 'e.g., -100 -64 -100', defPos1);
  form.textField('pos2', 'Position 2 (x y z)', 'e.g., 100 320 100', defPos2);

  const flags = zone?.flags ?? {
    preventPvP: false,
    preventHostileDamage: false,
    preventHostileMobSpawning: false,
    preventBlockBreaking: false,
    preventBlockPlacing: false,
    preventExplosions: false,
    preventBlockInteraction: false,
    preventItemPickup: false,
    preventFallDamage: false,
    preventMagicDamage: false,
    preventMobGriefing: false,
    preventEntityInteraction: false,
    preventProjectileUsage: false,
  };

  form.toggle('preventPvP', 'Prevent PvP (Players Only)', flags.preventPvP);
  form.toggle('preventHostileDamage', 'Prevent Hostile Damage (Players Only)', flags.preventHostileDamage);
  form.toggle(
    'preventHostileMobSpawning',
    'Prevent Hostile Mob Spawning (Non-Players)',
    flags.preventHostileMobSpawning,
  );
  form.toggle('preventBlockBreaking', 'Prevent Block Breaking (Players Only)', flags.preventBlockBreaking);
  form.toggle('preventBlockPlacing', 'Prevent Block Placing (Players Only)', flags.preventBlockPlacing);
  form.toggle('preventExplosions', 'Prevent Explosions (All Entities)', flags.preventExplosions);
  form.toggle('preventBlockInteraction', 'Prevent Block Interaction (Players Only)', flags.preventBlockInteraction);
  form.toggle('preventItemPickup', 'Prevent Item Pickup (Players Only)', flags.preventItemPickup);
  form.toggle('preventFallDamage', 'Prevent Fall Damage (All Entities)', flags.preventFallDamage);
  form.toggle('preventMagicDamage', 'Prevent Magic Damage (All Entities)', flags.preventMagicDamage);
  form.toggle('preventMobGriefing', 'Prevent Mob Griefing (Non-Players)', flags.preventMobGriefing);
  form.toggle('preventEntityInteraction', 'Prevent Entity Interaction (Players Only)', flags.preventEntityInteraction);
  form.toggle('preventProjectileUsage', 'Prevent Projectile Usage (Players Only)', flags.preventProjectileUsage);

  form.toggle('previewParticles', '§bPreview Zone Outline with Particles (20s)', false);
  if (isEdit) {
    form.toggle('isDelete', '§cDelete Zone§r', false);
  }
  form.submitButton('Save Settings');

  const response = await form.show(player);
  if (!response) {
    return showWorldProtectionListPanel(player, context);
  }

  const values = response;
  const newId = values.id.trim();
  const newName = values.name.trim();
  const selectedDim =
    typeof values.dimension === 'string' ? values.dimension : dimensions[values.dimension as unknown as number];
  const dimension = selectedDim || MinecraftDimensionTypes.Overworld;

  const parseCoords = (str: string) => {
    const parts = str.split(/[,\s]+/).map((p) => parseFloat(p));
    if (parts.length >= 3 && !isNaN(parts[0]!) && !isNaN(parts[1]!) && !isNaN(parts[2]!)) {
      return { x: parts[0]!, y: parts[1]!, z: parts[2]! };
    }
    return null;
  };

  const pos1 = parseCoords(values.pos1.trim());
  const pos2 = parseCoords(values.pos2.trim());

  if (!newId || !newName || !pos1 || !pos2) {
    player.sendMessage(
      '§cInvalid input. Please ensure coordinates are formatted correctly (x y z) and ID/Name are provided.',
    );
    return handleWorldProtectionForm(player, isEdit, context); // Basic recursive retry for now, any forms values was messy
  }

  const minX = Math.min(pos1.x, pos2.x);
  const minY = Math.min(pos1.y, pos2.y);
  const minZ = Math.min(pos1.z, pos2.z);

  const maxX = Math.max(pos1.x, pos2.x);
  const maxY = Math.max(pos1.y, pos2.y);
  const maxZ = Math.max(pos1.z, pos2.z);

  const newFlags = {
    preventPvP: values.preventPvP,
    preventHostileDamage: values.preventHostileDamage,
    preventHostileMobSpawning: values.preventHostileMobSpawning,
    preventBlockBreaking: values.preventBlockBreaking,
    preventBlockPlacing: values.preventBlockPlacing,
    preventExplosions: values.preventExplosions,
    preventBlockInteraction: values.preventBlockInteraction,
    preventItemPickup: values.preventItemPickup,
    preventFallDamage: values.preventFallDamage,
    preventMagicDamage: values.preventMagicDamage,
    preventMobGriefing: values.preventMobGriefing,
    preventEntityInteraction: values.preventEntityInteraction,
    preventProjectileUsage: values.preventProjectileUsage,
  };

  if (isEdit) {
    const oldZoneId = (context.selectedItemId as string).replace('zone_', '');

    if (values.isDelete) {
      config.zones = config.zones.filter((z) => z.id !== oldZoneId);
      player.sendMessage(`§aDeleted protection zone: ${oldZoneId}`);
    } else {
      const zoneIndex = config.zones.findIndex((z) => z.id === oldZoneId);
      if (zoneIndex > -1) {
        config.zones[zoneIndex] = {
          id: newId,
          name: newName,
          dimension,
          box: {
            min: { x: minX, y: minY, z: minZ },
            max: { x: maxX, y: maxY, z: maxZ },
          },
          flags: newFlags,
        };
        player.sendMessage(`§aUpdated protection zone: ${newName}`);
      }
    }
  } else {
    if (config.zones.some((z) => z.id === newId)) {
      player.sendMessage(`§cZone ID '${newId}' already exists.`);
      return showWorldProtectionListPanel(player, context);
    }
    config.zones.push({
      id: newId,
      name: newName,
      dimension,
      box: {
        min: { x: minX, y: minY, z: minZ },
        max: { x: maxX, y: maxY, z: maxZ },
      },
      flags: newFlags,
    });
    player.sendMessage(`§aCreated new protection zone: ${newName}`);
  }

  saveWorldProtectionConfig(config);
  if (values.previewParticles && !values.isDelete) {
    previewZoneBoundaryParticles(player, { x: minX, y: minY, z: minZ }, { x: maxX, y: maxY, z: maxZ }, dimension, 20);
  }
  return showWorldProtectionListPanel(player, context);
}

async function showGlobalProtectionRulesPanel(player: mc.Player, context: Record<string, unknown> = {}): Promise<void> {
  const config = getWorldProtectionConfig();
  const globalFlags = config.globalFlags ?? {
    preventPvP: false,
    preventExplosions: false,
    preventMobGriefing: false,
    preventFireSpread: false,
  };
  const auditLog = config.auditLog ?? {
    enabled: false,
    maxEntries: 500,
    retentionMinutes: 1440,
    logContainerAccess: true,
    logValuableBlocks: true,
    logHazardousPlacement: true,
  };

  type GlobalRulesForm = {
    preventPvP: boolean;
    preventExplosions: boolean;
    preventMobGriefing: boolean;
    preventFireSpread: boolean;
    auditEnabled: boolean;
    auditMaxEntries: string;
    auditRetentionMinutes: string;
  };

  const form = new CustomFormBuilder<GlobalRulesForm>('Global World Protection & Audit')
    .toggle('preventPvP', 'Global Prevent PvP', globalFlags.preventPvP)
    .toggle('preventExplosions', 'Global Prevent Explosions', globalFlags.preventExplosions)
    .toggle('preventMobGriefing', 'Global Prevent Mob Griefing', globalFlags.preventMobGriefing)
    .toggle('preventFireSpread', 'Global Prevent Fire Spread', globalFlags.preventFireSpread)
    .toggle('auditEnabled', 'Enable Protection Audit Log (Capped)', auditLog.enabled)
    .textField('auditMaxEntries', 'Audit Max Entries (10-2000)', '500', String(auditLog.maxEntries))
    .textField('auditRetentionMinutes', 'Audit Retention (Minutes)', '1440', String(auditLog.retentionMinutes))
    .submitButton('Save Global Rules');

  const v = await form.show(player);
  if (!v) {
    await showWorldProtectionListPanel(player, context);
    return;
  }

  config.globalFlags = {
    preventPvP: v.preventPvP,
    preventExplosions: v.preventExplosions,
    preventMobGriefing: v.preventMobGriefing,
    preventFireSpread: v.preventFireSpread,
  };
  config.auditLog = {
    ...auditLog,
    enabled: v.auditEnabled,
    maxEntries: Math.max(10, Math.min(2000, Number.parseInt(v.auditMaxEntries, 10) || 500)),
    retentionMinutes: Math.max(1, Number.parseInt(v.auditRetentionMinutes, 10) || 1440),
  };
  saveWorldProtectionConfig(config);
  player.sendMessage('§aSaved global world protection rules.');
  await showWorldProtectionListPanel(player, context);
}

async function showSpawnProtectionQuickPanel(player: mc.Player, context: Record<string, unknown> = {}): Promise<void> {
  const cfg = getConfig();
  const sp = cfg.spawnProtection;
  type SpawnProtForm = {
    enabled: boolean;
    radius: string;
    allowAdminBypass: boolean;
    preventPvP: boolean;
    preventBlockBreaking: boolean;
    preventBlockPlacing: boolean;
    preventExplosions: boolean;
    preventMobGriefing: boolean;
  };

  const form = new CustomFormBuilder<SpawnProtForm>('Spawn Protection Settings')
    .toggle('enabled', 'Enable Spawn Protection', Boolean(sp.enabled))
    .textField('radius', 'Protection Radius (Blocks)', '32', String(sp.protectionRadius ?? 32))
    .toggle('allowAdminBypass', 'Allow Admin/Mod Bypass', Boolean(sp.allowAdminBypass))
    .toggle('preventPvP', 'Prevent PvP', Boolean(sp.preventPvP))
    .toggle('preventBlockBreaking', 'Prevent Block Breaking', Boolean(sp.preventBlockBreaking))
    .toggle('preventBlockPlacing', 'Prevent Block Placing', Boolean(sp.preventBlockPlacing))
    .toggle('preventExplosions', 'Prevent Explosions', Boolean(sp.preventExplosions))
    .toggle('preventMobGriefing', 'Prevent Mob Griefing', Boolean(sp.preventMobGriefing))
    .submitButton('Save Spawn Protection');

  const v = await form.show(player);
  if (!v) {
    await showWorldProtectionListPanel(player, context);
    return;
  }
  const parsedRadius = Math.max(0, Number.parseInt(v.radius, 10) || 0);
  updateConfig('spawnProtection', {
    ...sp,
    enabled: v.enabled,
    protectionRadius: parsedRadius,
    allowAdminBypass: v.allowAdminBypass,
    preventPvP: v.preventPvP,
    preventBlockBreaking: v.preventBlockBreaking,
    preventBlockPlacing: v.preventBlockPlacing,
    preventExplosions: v.preventExplosions,
    preventMobGriefing: v.preventMobGriefing,
  });
  player.sendMessage('§aSaved spawn protection settings.');
  await showWorldProtectionListPanel(player, context);
}

async function showNearbyAuditLogsPanel(player: mc.Player, context: Record<string, unknown> = {}): Promise<void> {
  const logs = getAuditLogsNear(player.location, player.dimension.id, 8, 20);
  const lines =
    logs.length === 0
      ? '§7No recorded valuable/container/hazardous events within 8 blocks.'
      : logs
          .map((e) => {
            const ageSec = Math.max(0, Math.floor((Date.now() - e.timestamp) / 1000));
            return `§8[${ageSec}s] §e${e.playerName} §f${e.action} §b${e.blockType.replace('minecraft:', '')} §7(${e.x}, ${e.y}, ${e.z})`;
          })
          .join('\n');

  const form = new ActionFormBuilder().title('Nearby Protection Audit Logs').body(lines);
  if (logs.length > 0) {
    form.button('§cClear All Audit Logs', 'textures/ui/trash', async () => {
      clearProtectionAuditLogs();
      player.sendMessage('§aCleared protection audit logs.');
      await showWorldProtectionListPanel(player, context);
    });
  }
  form.addBackButton(async () => {
    await showWorldProtectionListPanel(player, context);
  });
  await form.show(player);
}
