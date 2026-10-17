import * as mc from '@minecraft/server';

import { getNetherBorderRadius, getWorldBorder, setEndBorder, setOverworldBorder, updateWorldBorderConfig } from '@features/essentials/worldBorderManager.js';
import { ActionFormBuilder } from '@ui/builders/ActionFormBuilder.js';
import { CustomFormBuilder } from '@ui/builders/CustomFormBuilder.js';

export async function showWorldBorderAdminPanel(player: mc.Player): Promise<void> {
    const cfg = getWorldBorder();
    const netherRadius = getNetherBorderRadius(cfg.overworldRadius, cfg.netherMultiplier);
    const netherCenterX = Math.floor(cfg.overworldCenterX / Math.max(1, cfg.netherMultiplier));
    const netherCenterZ = Math.floor(cfg.overworldCenterZ / Math.max(1, cfg.netherMultiplier));

    const bodyText = [
        `§l§aOverworld + Nether Border (1:${cfg.netherMultiplier} Linked):§r`,
        `  §7Status: ${cfg.overworldEnabled ? '§aENABLED' : '§cDISABLED'}`,
        `  §7Overworld: §f±${cfg.overworldRadius} blocks §8(Center: ${cfg.overworldCenterX}, ${cfg.overworldCenterZ})`,
        `  §7Nether (Auto 1/${cfg.netherMultiplier}): §d±${netherRadius} blocks §8(Center: ${netherCenterX}, ${netherCenterZ})`,
        '',
        '§l§dThe End Border:§r',
        `  §7Status: ${cfg.endEnabled ? '§aENABLED' : '§cDISABLED'}`,
        `  §7The End: §f±${cfg.endRadius} blocks §8(Center: ${cfg.endCenterX}, ${cfg.endCenterZ})`,
        '',
        `§7Admin Bypass: ${cfg.adminBypass ? '§aON' : '§cOFF'} §8| §7Pushback Buffer: §f${cfg.knockbackBuffer} blocks`
    ].join('\n');

    const form = new ActionFormBuilder()
        .title('World Border Manager')
        .body(bodyText)
        .button(
            cfg.overworldEnabled ? '§2Overworld + Nether: ENABLED\n§7Click to Disable' : '§4Overworld + Nether: DISABLED\n§7Click to Enable',
            cfg.overworldEnabled ? 'textures/ui/realms_green_check' : 'textures/ui/cancel',
            async () => {
                const next = !cfg.overworldEnabled;
                setOverworldBorder(next);
                player.sendMessage(`§aOverworld + Nether border is now ${next ? '§2ENABLED' : '§cDISABLED'}§a.`);
                await showWorldBorderAdminPanel(player);
            }
        )
        .button(
            cfg.endEnabled ? '§2The End Border: ENABLED\n§7Click to Disable' : '§4The End Border: DISABLED\n§7Click to Enable',
            cfg.endEnabled ? 'textures/ui/realms_green_check' : 'textures/ui/cancel',
            async () => {
                const next = !cfg.endEnabled;
                setEndBorder(next);
                player.sendMessage(`§aThe End border is now ${next ? '§2ENABLED' : '§cDISABLED'}§a.`);
                await showWorldBorderAdminPanel(player);
            }
        )
        .button(`Configure Overworld + Nether\n§7OW: ${cfg.overworldRadius} | Nether: ${netherRadius}`, 'textures/blocks/grass_side_carried', async () => {
            await showEditOverworldBorderModal(player);
        })
        .button(`Configure The End Border\n§7Radius: ${cfg.endRadius}`, 'textures/blocks/end_stone', async () => {
            await showEditEndBorderModal(player);
        })
        .button('General Border Settings\n§7Multiplier, Buffer & Admin Bypass', 'textures/ui/icon_setting', async () => {
            await showEditGeneralBorderModal(player);
        });

    form.addBackButton(async () => {
        const { showStaffWorldHub } = await import('@core/ui/panels/adminPanel.js');
        await showStaffWorldHub(player);
    });

    await form.show(player);
}

async function showEditOverworldBorderModal(player: mc.Player): Promise<void> {
    const cfg = getWorldBorder();
    const modal = new CustomFormBuilder<{
        enabled: boolean;
        radius: string;
        centerX: string;
        centerZ: string;
        useMyPos: boolean;
    }>('Overworld + Nether Border')
        .toggle('enabled', 'Enable Overworld + Nether Border', cfg.overworldEnabled)
        .textField('radius', `Overworld Radius (Nether auto-scales by 1/${cfg.netherMultiplier})`, '8000', String(cfg.overworldRadius))
        .textField('centerX', 'Overworld Center X', '0', String(cfg.overworldCenterX))
        .textField('centerZ', 'Overworld Center Z', '0', String(cfg.overworldCenterZ))
        .toggle('useMyPos', 'Set Center to My Current X/Z Position', false)
        .submitButton('Save Border');

    const res = await modal.show(player);
    if (!res) {
        await showWorldBorderAdminPanel(player);
        return;
    }

    const parsedRadius = Number.parseInt(res.radius, 10);
    const parsedX = res.useMyPos ? Math.floor(player.location.x) : Number.parseInt(res.centerX, 10);
    const parsedZ = res.useMyPos ? Math.floor(player.location.z) : Number.parseInt(res.centerZ, 10);

    if (Number.isNaN(parsedRadius) || parsedRadius < 16) {
        player.sendMessage('§cInvalid radius. Minimum radius is 16 blocks.');
        await showWorldBorderAdminPanel(player);
        return;
    }

    const updated = setOverworldBorder(res.enabled, parsedRadius, Number.isNaN(parsedX) ? cfg.overworldCenterX : parsedX, Number.isNaN(parsedZ) ? cfg.overworldCenterZ : parsedZ);
    const netherRad = getNetherBorderRadius(updated.overworldRadius, updated.netherMultiplier);
    player.sendMessage(
        `§aSaved Overworld + Nether border: §e±${updated.overworldRadius}§a in Overworld / §d±${netherRad}§a in Nether (Center: ${updated.overworldCenterX}, ${updated.overworldCenterZ}).`
    );
    await showWorldBorderAdminPanel(player);
}

async function showEditEndBorderModal(player: mc.Player): Promise<void> {
    const cfg = getWorldBorder();
    const modal = new CustomFormBuilder<{
        enabled: boolean;
        radius: string;
        centerX: string;
        centerZ: string;
        useMyPos: boolean;
    }>('The End Border')
        .toggle('enabled', 'Enable The End Border', cfg.endEnabled)
        .textField('radius', 'End Border Radius (blocks)', '5000', String(cfg.endRadius))
        .textField('centerX', 'End Center X', '0', String(cfg.endCenterX))
        .textField('centerZ', 'End Center Z', '0', String(cfg.endCenterZ))
        .toggle('useMyPos', 'Set Center to My Current X/Z Position', false)
        .submitButton('Save End Border');

    const res = await modal.show(player);
    if (!res) {
        await showWorldBorderAdminPanel(player);
        return;
    }

    const parsedRadius = Number.parseInt(res.radius, 10);
    const parsedX = res.useMyPos ? Math.floor(player.location.x) : Number.parseInt(res.centerX, 10);
    const parsedZ = res.useMyPos ? Math.floor(player.location.z) : Number.parseInt(res.centerZ, 10);

    if (Number.isNaN(parsedRadius) || parsedRadius < 16) {
        player.sendMessage('§cInvalid radius. Minimum radius is 16 blocks.');
        await showWorldBorderAdminPanel(player);
        return;
    }

    const updated = setEndBorder(res.enabled, parsedRadius, Number.isNaN(parsedX) ? cfg.endCenterX : parsedX, Number.isNaN(parsedZ) ? cfg.endCenterZ : parsedZ);
    player.sendMessage(`§aSaved The End border: §e±${updated.endRadius}§a blocks (Center: ${updated.endCenterX}, ${updated.endCenterZ}).`);
    await showWorldBorderAdminPanel(player);
}

async function showEditGeneralBorderModal(player: mc.Player): Promise<void> {
    const cfg = getWorldBorder();
    const modal = new CustomFormBuilder<{
        adminBypass: boolean;
        netherMultiplier: string;
        knockbackBuffer: string;
    }>('General Border Settings')
        .toggle('adminBypass', 'Allow Admin & Spectator Bypass', cfg.adminBypass)
        .textField('netherMultiplier', 'Overworld-to-Nether Coordinate Multiplier (Vanilla = 8)', '8', String(cfg.netherMultiplier))
        .textField('knockbackBuffer', 'Safe Pushback Buffer Distance (blocks)', '3', String(cfg.knockbackBuffer))
        .submitButton('Save Settings');

    const res = await modal.show(player);
    if (!res) {
        await showWorldBorderAdminPanel(player);
        return;
    }

    const mult = Number.parseInt(res.netherMultiplier, 10);
    const buf = Number.parseInt(res.knockbackBuffer, 10);

    updateWorldBorderConfig({
        adminBypass: res.adminBypass,
        netherMultiplier: !Number.isNaN(mult) && mult >= 1 ? mult : 8,
        knockbackBuffer: !Number.isNaN(buf) && buf >= 1 ? buf : 3
    });

    player.sendMessage('§aUpdated general World Border settings.');
    await showWorldBorderAdminPanel(player);
}
