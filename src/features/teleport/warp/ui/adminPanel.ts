import { getConfig } from '@core/config/configManager.js';
import { executeTeleport } from '@features/teleport/utils.js';
import * as warpsManager from '@features/teleport/warp/manager.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { MinecraftDimensionTypes } from '@minecraft/vanilla-data';
import { ActionFormBuilder } from '@ui/builders/actionFormBuilder.js';
import { CustomFormBuilder } from '@ui/builders/customFormBuilder.js';

const dimensionOptions = [
  MinecraftDimensionTypes.Overworld,
  MinecraftDimensionTypes.Nether,
  MinecraftDimensionTypes.TheEnd,
];

export async function showWarpsAdminPanel(player: mc.Player): Promise<void> {
  const warpNames = warpsManager.listWarps();

  const form = new ActionFormBuilder()
    .title('Server Warps Manager')
    .body(`Total Warps: ${warpNames.length}`)
    .button('§2+ Create Warp at My Location', 'textures/ui/color_plus', async () => {
      const modal = new CustomFormBuilder<{ name: string }>('Create Warp Here')
        .textField('name', 'Warp Name', 'spawn_shop', '')
        .submitButton('Create Warp');
      const res = await modal.show(player);
      if (res && isNonEmptyString(res.name.trim())) {
        const createRes = warpsManager.setWarp(res.name.trim(), player.location, player.dimension.id);
        player.sendMessage(createRes.success ? `§a${createRes.message}` : `§c${createRes.message}`);
      }
      await showWarpsAdminPanel(player);
    })
    .button('§6+ Create Warp (Custom Coords)', 'textures/ui/icon_map', async () => {
      await showEditWarpModal(player);
    })
    .button('Warp Cooldown & Warmup Settings', 'textures/ui/icon_setting', async () => {
      const { showConfigSystemPanel } = await import('@core/ui/panels/configPanel.js');
      await showConfigSystemPanel(player, 'warps');
    });

  for (const warpName of warpNames) {
    const loc = warpsManager.getWarp(warpName);
    const desc = loc ? `X: ${loc.x.toFixed(1)}, Y: ${loc.y.toFixed(1)}, Z: ${loc.z.toFixed(1)}` : '';
    form.button(`§l${warpName}§r\n§7${desc}`, 'textures/ui/NetherPortal', async () => {
      await showWarpActionModal(player, warpName);
    });
  }

  form.addBackButton(async () => {
    const { showStaffWorldHub } = await import('@core/ui/panels/adminPanel.js');
    await showStaffWorldHub(player);
  });

  await form.show(player);
}

async function showWarpActionModal(player: mc.Player, warpName: string): Promise<void> {
  const loc = warpsManager.getWarp(warpName);
  if (!isDefined(loc)) {
    await showWarpsAdminPanel(player);
    return;
  }

  const form = new ActionFormBuilder()
    .title(`Warp: ${warpName}`)
    .body(
      `§7Location: §f${loc.x.toFixed(2)}, ${loc.y.toFixed(2)}, ${loc.z.toFixed(2)}\n§7Dimension: §f${loc.dimensionId}`,
    )
    .button('Teleport to Warp', 'textures/ui/icon_map', () => {
      const config = getConfig();
      executeTeleport({
        executor: player,
        location: loc,
        destinationName: warpName,
        teleportType: 'warp',
        warmupSeconds: config.warps.teleportWarmupSeconds,
        cooldownSeconds: config.warps.cooldownSeconds,
        cooldownKey: 'warp',
      });
    })
    .button('Move Warp to My Current Position', 'textures/ui/refresh_light', async () => {
      const res = warpsManager.setWarp(warpName, player.location, player.dimension.id, true);
      player.sendMessage(res.success ? `§a${res.message}` : `§c${res.message}`);
      await showWarpActionModal(player, warpName);
    })
    .button('Edit Coordinates', 'textures/ui/book_edit_default', async () => {
      await showEditWarpModal(player, warpName);
    })
    .button('§4Delete Warp', 'textures/ui/trash', async () => {
      const res = warpsManager.deleteWarp(warpName);
      player.sendMessage(res.success ? `§a${res.message}` : `§c${res.message}`);
      await showWarpsAdminPanel(player);
    });

  form.addBackButton(async () => {
    await showWarpsAdminPanel(player);
  });

  await form.show(player);
}

async function showEditWarpModal(player: mc.Player, existingWarpName?: string): Promise<void> {
  const existing = existingWarpName ? warpsManager.getWarp(existingWarpName) : undefined;
  const dimIdx = existing ? Math.max(0, dimensionOptions.indexOf(existing.dimensionId as MinecraftDimensionTypes)) : 0;

  const modal = new CustomFormBuilder<{
    name: string;
    x: string;
    y: string;
    z: string;
    dim: string;
  }>(existingWarpName ? `Edit Warp: ${existingWarpName}` : 'Create Custom Warp')
    .textField('name', 'Warp Name', 'arena', existingWarpName ?? '')
    .textField('x', 'X Coordinate', '0', existing ? String(existing.x) : String(Math.floor(player.location.x)))
    .textField('y', 'Y Coordinate', '64', existing ? String(existing.y) : String(Math.floor(player.location.y)))
    .textField('z', 'Z Coordinate', '0', existing ? String(existing.z) : String(Math.floor(player.location.z)))
    .dropdown('dim', 'Dimension', dimensionOptions, dimIdx)
    .submitButton('Save Warp');

  const res = await modal.show(player);
  if (!res) {
    await showWarpsAdminPanel(player);
    return;
  }

  const name = res.name.trim();
  const x = Number.parseFloat(res.x);
  const y = Number.parseFloat(res.y);
  const z = Number.parseFloat(res.z);

  if (!isNonEmptyString(name) || Number.isNaN(x) || Number.isNaN(y) || Number.isNaN(z)) {
    player.sendMessage('§cInvalid warp name or coordinates.');
    await showWarpsAdminPanel(player);
    return;
  }

  if (existingWarpName && existingWarpName.toLowerCase() !== name.toLowerCase()) {
    warpsManager.deleteWarp(existingWarpName);
  }

  const saveRes = warpsManager.setWarp(
    name,
    { x, y, z },
    res.dim || MinecraftDimensionTypes.Overworld,
    Boolean(existingWarpName),
  );
  player.sendMessage(saveRes.success ? `§a${saveRes.message}` : `§c${saveRes.message}`);
  await showWarpsAdminPanel(player);
}
