import * as mc from '@minecraft/server';

import { getConfig } from '@core/config/configManager.js';
import { getPlayerFromCache } from '@core/data/playerCache.js';
import { getVisiblePlayers } from '@core/data/playerDataManager.js';
import { showPanel } from '@core/ui/uiManager.js';
import * as homesManager from '@features/teleport/homesManager.js';
import * as tpaManager from '@features/teleport/tpaManager.js';
import { showTpaSettingsPanel } from '@features/teleport/ui/panel.js';
import { executeTeleport } from '@features/teleport/utils.js';
import * as warpsManager from '@features/teleport/warpsManager.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import { ActionFormBuilder } from '@ui/builders/actionFormBuilder.js';
import { CustomFormBuilder } from '@ui/builders/customFormBuilder.js';

export async function showHomesMenuPanel(player: mc.Player): Promise<void> {
    const config = getConfig();
    if (!config.homes.enabled) {
        player.sendMessage('§cThe Homes system is currently disabled.');
        await showPanel(player, 'teleportHub');
        return;
    }

    const homes = homesManager.listHomes(player);
    const maxHomes = config.homes.maxHomes;

    const form = new ActionFormBuilder()
        .title(`My Homes (${homes.length}/${maxHomes})`)
        .body('Select a home to teleport or manage, or set a new home at your current position:')
        .button('§l§2+ Set New Home Here\n§r§7Save current location', 'textures/ui/color_plus', async () => {
            const modal = new CustomFormBuilder<{ name: string }>('Set Home').textField('name', 'Home Name (max 20 chars)', 'home', `home${homes.length + 1}`).submitButton('Save Home');
            const res = await modal.show(player);
            if (res && isNonEmptyString(res.name.trim())) {
                const out = homesManager.setHome(player, res.name.trim());
                player.sendMessage(out.success ? `§a${out.message}` : `§c${out.message}`);
            }
            await showHomesMenuPanel(player);
        });

    for (const hName of homes) {
        const loc = homesManager.getHome(player, hName);
        const coords = isDefined(loc) ? `${Math.floor(loc.x)}, ${Math.floor(loc.y)}, ${Math.floor(loc.z)}` : '';
        form.button(`§l§e${hName}§r\n§7${coords}`, 'textures/ui/icon_recipe_item', async () => {
            await showHomeItemActionPanel(player, hName);
        });
    }

    form.addBackButton(async () => {
        await showPanel(player, 'teleportHub');
    });

    await form.show(player);
}

async function showHomeItemActionPanel(player: mc.Player, homeName: string): Promise<void> {
    const loc = homesManager.getHome(player, homeName);
    if (!isDefined(loc)) {
        await showHomesMenuPanel(player);
        return;
    }

    const config = getConfig();
    const form = new ActionFormBuilder()
        .title(`Home: ${homeName}`)
        .body(`§7Coordinates: §f${loc.x.toFixed(1)}, ${loc.y.toFixed(1)}, ${loc.z.toFixed(1)}\n§7Dimension: §b${loc.dimensionId.replace(/^minecraft:/, '')}`)
        .button('§l§aTeleport to Home', 'textures/ui/icon_map', () => {
            executeTeleport({
                executor: player,
                location: loc,
                destinationName: homeName,
                teleportType: 'home',
                warmupSeconds: config.homes.teleportWarmupSeconds,
                cooldownSeconds: config.homes.cooldownSeconds,
                cooldownKey: 'homes'
            });
        })
        .button('§l§4Delete Home', 'textures/ui/trash', async () => {
            const out = homesManager.deleteHome(player, homeName);
            player.sendMessage(out.success ? `§a${out.message}` : `§c${out.message}`);
            await showHomesMenuPanel(player);
        });

    form.addBackButton(async () => {
        await showHomesMenuPanel(player);
    });

    await form.show(player);
}

export async function showWarpsMenuPanel(player: mc.Player): Promise<void> {
    const config = getConfig();
    if (!config.warps.enabled) {
        player.sendMessage('§cThe Warps system is currently disabled.');
        await showPanel(player, 'teleportHub');
        return;
    }

    const warps = warpsManager.listWarps();
    const form = new ActionFormBuilder().title(`Server Warps (${warps.length})`).body(warps.length > 0 ? 'Select a public warp to teleport:' : 'No server warps have been created yet.');

    for (const wName of warps) {
        const loc = warpsManager.getWarp(wName);
        if (isDefined(loc)) {
            form.button(`§l§b${wName}§r\n§7${Math.floor(loc.x)}, ${Math.floor(loc.y)}, ${Math.floor(loc.z)}`, 'textures/blocks/portal', () => {
                executeTeleport({
                    executor: player,
                    location: loc,
                    destinationName: wName,
                    teleportType: 'warp',
                    warmupSeconds: config.warps.teleportWarmupSeconds,
                    cooldownSeconds: config.warps.cooldownSeconds,
                    cooldownKey: 'warp'
                });
            });
        }
    }

    form.addBackButton(async () => {
        await showPanel(player, 'teleportHub');
    });

    await form.show(player);
}

export async function showTpaMenuPanel(player: mc.Player): Promise<void> {
    const config = getConfig();
    if (!config.tpa.enabled) {
        player.sendMessage('§cThe TPA system is currently disabled.');
        await showPanel(player, 'teleportHub');
        return;
    }

    const incoming = tpaManager.getIncomingRequest(player);
    const outgoing = tpaManager.getOutgoingRequest(player);

    const lines = ['§7Request to teleport to another player or invite them to teleport to you:'];
    if (isDefined(incoming)) {
        lines.push(`\n§aIncoming Request: §e${incoming.sourcePlayerName} §7(${incoming.type.toUpperCase()})`);
    }
    if (isDefined(outgoing)) {
        lines.push(`\n§eOutgoing Request to: §f${outgoing.targetPlayerName} §7(${outgoing.type.toUpperCase()})`);
    }

    const form = new ActionFormBuilder()
        .title('Teleport Requests (TPA)')
        .body(lines.join('\n'))
        .button('§l§aSend TPA Request\n§r§7Teleport to a player', 'textures/items/ender_pearl', async () => {
            await showSendTpaModal(player, 'tpa');
        })
        .button('§l§bSend TPAHere Request\n§r§7Ask player to teleport to you', 'textures/ui/icon_map', async () => {
            await showSendTpaModal(player, 'tpahere');
        });

    if (isDefined(incoming)) {
        form.button(`§2Accept Request from ${incoming.sourcePlayerName}`, 'textures/ui/realms_green_check', () => {
            tpaManager.acceptRequest(player, incoming.sourcePlayerName);
        });
        form.button(`§cDeny Request from ${incoming.sourcePlayerName}`, 'textures/ui/cancel', async () => {
            tpaManager.denyRequest(player, incoming.sourcePlayerName);
            await showTpaMenuPanel(player);
        });
    }

    if (isDefined(outgoing)) {
        form.button(`§cCancel Outgoing Request to ${outgoing.targetPlayerName}`, 'textures/ui/cancel', async () => {
            tpaManager.cancelRequest(player);
            await showTpaMenuPanel(player);
        });
    }

    form.button('§eTPA Privacy & Blocklist', 'textures/ui/icon_setting', async () => {
        await showTpaSettingsPanel(player);
    });

    form.addBackButton(async () => {
        await showPanel(player, 'teleportHub');
    });

    await form.show(player);
}

async function showSendTpaModal(player: mc.Player, type: 'tpa' | 'tpahere'): Promise<void> {
    const candidates = getVisiblePlayers(player).filter((p) => p.id !== player.id);
    if (candidates.length === 0) {
        player.sendMessage('§cNo other players are currently online.');
        await showTpaMenuPanel(player);
        return;
    }

    const names = candidates.map((p) => p.name);
    const modal = new CustomFormBuilder<{ targetName: string }>(type === 'tpa' ? 'Teleport To Player (TPA)' : 'Teleport Player Here (TPAHere)')
        .dropdown('targetName', 'Select Online Player', names, 0)
        .submitButton('Send Request');

    const res = await modal.show(player);
    if (!res) {
        await showTpaMenuPanel(player);
        return;
    }

    const target = candidates.find((p) => p.name === res.targetName) ?? getPlayerFromCache(res.targetName);
    if (!isDefined(target)) {
        player.sendMessage('§cPlayer is no longer online.');
        await showTpaMenuPanel(player);
        return;
    }

    const out = tpaManager.createRequest(player, target, type);
    player.sendMessage(out.success ? `§a${out.message}` : `§c${out.message}`);
    if (out.success && !out.autoAccepted) {
        const msgStr = type === 'tpa' ? 'to teleport to you' : 'for you to teleport to them';
        target.sendMessage(`§a${player.name} has requested ${msgStr}. Type §e/tpaccept§a or open §e/panel -> Teleportation§a.`);
    }
}
