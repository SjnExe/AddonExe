/* eslint-disable */
import { MinecraftDimensionTypes } from '@minecraft/vanilla-data';

import * as mc from '@minecraft/server';
import { ActionFormBuilder } from '@ui/builders/ActionFormBuilder.js';
import { ModalFormBuilder } from '@ui/builders/ModalFormBuilder.js';

import { getWorldProtectionConfig, saveWorldProtectionConfig } from '@core/configurations.js';
import { showPanel } from '@core/uiManager.js';
import { WorldProtectionZone } from '@features/essentials/worldProtectionConfig.js';

export async function showWorldProtectionListPanel(player: mc.Player, context: any = {}): Promise<void> {
    const config = getWorldProtectionConfig();
    const form = new ActionFormBuilder().title('World Protection Zones');

    form.button('Add New Zone', 'textures/ui/color_plus', async () => {
        await (showPanel as any)(player, 'addWorldProtectionPanel', { ...context, page: 1 });
    });

    config.zones.forEach((zone) => {
        form.button(zone.name, 'textures/ui/icon_recipe_nature', async () => {
            await (showPanel as any)(player, 'editWorldProtectionPanel', {
                ...context,
                page: 1,
                selectedItemId: `zone_${zone.id}`
            });
        });
    });

    form.addBackButton(async () => {
        await (showPanel as any)(player, 'essentialsMainPanel', context);
    });

    await form.show(player);
}

export async function showAddWorldProtectionPanel(player: mc.Player, context: any = {}): Promise<void> {
    await handleWorldProtectionForm(player, false, context);
}

export async function showEditWorldProtectionPanel(player: mc.Player, context: any): Promise<void> {
    await handleWorldProtectionForm(player, true, context);
}

type WorldProtectionFormVals = {
    id: string;
    name: string;
    dimension: number;
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
    isDelete?: boolean;
};

async function handleWorldProtectionForm(player: mc.Player, isEdit: boolean, context: any): Promise<void> {
    const config = getWorldProtectionConfig();
    let zone: WorldProtectionZone | undefined;

    if (isEdit && context.selectedItemId) {
        const zoneId = context.selectedItemId.replace('zone_', '');
        zone = config.zones.find((z) => z.id === zoneId);
        if (!zone) return showWorldProtectionListPanel(player, context);
    }

    const form = new ModalFormBuilder<WorldProtectionFormVals>().title(isEdit ? `Edit Zone: ${zone?.name}` : 'Add Protection Zone');

    form.textField('id', 'Zone ID/Name (No spaces recommended)', 'e.g., spawn_city', zone?.id ?? '');
    form.textField('name', 'Display Name', 'e.g., Spawn City', zone?.name ?? '');

    const dimensions = [MinecraftDimensionTypes.Overworld, MinecraftDimensionTypes.Nether, MinecraftDimensionTypes.TheEnd];
    const dimIndex = zone ? Math.max(0, dimensions.indexOf(zone.dimension as MinecraftDimensionTypes)) : 0;
    form.dropdown('dimension', 'Dimension', dimensions, dimIndex);

    const defPos1 = zone ? `${zone.box.min.x} ${zone.box.min.y} ${zone.box.min.z}` : '';
    const defPos2 = zone ? `${zone.box.max.x} ${zone.box.max.y} ${zone.box.max.z}` : '';

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
        preventProjectileUsage: false
    };

    form.toggle('preventPvP', 'Prevent PvP (Players Only)', flags.preventPvP);
    form.toggle('preventHostileDamage', 'Prevent Hostile Damage (Players Only)', flags.preventHostileDamage);
    form.toggle('preventHostileMobSpawning', 'Prevent Hostile Mob Spawning (Non-Players)', flags.preventHostileMobSpawning);
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

    if (isEdit) {
        form.toggle('isDelete', '§cDelete Zone§r', false);
    }

    const response = await form.show(player);
    if (!response) return showWorldProtectionListPanel(player, context);

    const values = response;
    const newId = values.id.trim();
    const newName = values.name.trim();
    const dimension = dimensions[values.dimension] as string;

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
        player.sendMessage('§cInvalid input. Please ensure coordinates are formatted correctly (x y z) and ID/Name are provided.');
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
        preventProjectileUsage: values.preventProjectileUsage
    };

    if (isEdit) {
        const oldZoneId = context.selectedItemId!.replace('zone_', '');

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
                        max: { x: maxX, y: maxY, z: maxZ }
                    },
                    flags: newFlags
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
                max: { x: maxX, y: maxY, z: maxZ }
            },
            flags: newFlags
        });
        player.sendMessage(`§aCreated new protection zone: ${newName}`);
    }

    saveWorldProtectionConfig(config);
    return showWorldProtectionListPanel(player, context);
}
