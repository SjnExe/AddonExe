import { MinecraftDimensionTypes } from '@minecraft/vanilla-data';

import * as mc from '@minecraft/server';
import { ActionFormData, ActionFormResponse, ModalFormData, ModalFormResponse } from '@minecraft/server-ui';

import { getWorldProtectionConfig, saveWorldProtectionConfig } from '@core/configurations.js';
import { IPanelHandler, PanelItem, UIContext } from '@core/ui/types.js';
import { showPanel } from '@core/uiManager.js';
import { WorldProtectionZone } from '@features/essentials/worldProtectionConfig.js';

export class WorldProtectionPanelHandler implements IPanelHandler {
    canHandle(panelId: string): boolean {
        return ['worldProtectionListPanel', 'addWorldProtectionPanel', 'editWorldProtectionPanel'].includes(panelId);
    }

    getItems(_player: mc.Player, panelId: string, _context: UIContext): Promise<PanelItem[] | undefined> {
        if (panelId === 'worldProtectionListPanel') {
            const config = getWorldProtectionConfig();
            const items: PanelItem[] = [
                {
                    id: 'addZone',
                    text: 'Add New Zone',
                    icon: 'textures/ui/color_plus',
                    permission: 'ui.panel.admin',
                    actionType: 'openPanel',
                    actionValue: 'addWorldProtectionPanel',
                    sortId: 0
                }
            ];

            config.zones.forEach((zone, index) => {
                items.push({
                    id: `zone_${zone.id}`,
                    text: zone.name,
                    icon: 'textures/ui/icon_recipe_nature',
                    permission: 'ui.panel.admin',
                    actionType: 'openPanel',
                    actionValue: 'editWorldProtectionPanel',
                    sortId: index + 1
                });
            });

            return Promise.resolve(items);
        }
        return Promise.resolve(undefined);
    }

    buildModal(_player: mc.Player, panelId: string, context: UIContext): Promise<ModalFormData | ActionFormData | undefined> {
        if (panelId === 'addWorldProtectionPanel' || panelId === 'editWorldProtectionPanel') {
            const isEdit = panelId === 'editWorldProtectionPanel';
            const config = getWorldProtectionConfig();

            let zone: WorldProtectionZone | undefined;
            if (isEdit && context.selectedItemId) {
                const zoneId = context.selectedItemId.replace('zone_', '');
                zone = config.zones.find((z) => z.id === zoneId);
                if (!zone) return Promise.resolve(undefined);
            }

            const form = new ModalFormData();
            form.title(isEdit ? `Edit Zone: ${zone?.name}` : 'Add Protection Zone');

            form.textField('Zone ID/Name (No spaces recommended)', 'e.g., spawn_city', { defaultValue: zone?.id ?? '' });
            form.textField('Display Name', 'e.g., Spawn City', { defaultValue: zone?.name ?? '' });

            const dimensions = [MinecraftDimensionTypes.Overworld, MinecraftDimensionTypes.Nether, MinecraftDimensionTypes.TheEnd];
            const dimIndex = zone ? Math.max(0, dimensions.indexOf(zone.dimension as MinecraftDimensionTypes)) : 0;
            form.dropdown('Dimension', dimensions, { defaultValueIndex: dimIndex });

            // Use context.formValues to restore state on error
            // Ensure backwards compatibility by falling back to zone or empty
            const restoredValues = context.formValues as unknown[] | undefined;

            const defPos1 = restoredValues ? (restoredValues[3] as string) : zone ? `${zone.box.min.x} ${zone.box.min.y} ${zone.box.min.z}` : '';
            const defPos2 = restoredValues ? (restoredValues[4] as string) : zone ? `${zone.box.max.x} ${zone.box.max.y} ${zone.box.max.z}` : '';

            // Coordinates
            form.textField('Position 1 (x y z)', 'e.g., -100 -64 -100', { defaultValue: defPos1 });
            form.textField('Position 2 (x y z)', 'e.g., 100 320 100', { defaultValue: defPos2 });

            // Flags
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

            form.toggle('Prevent PvP (Players Only)', { defaultValue: restoredValues ? (restoredValues[5] as boolean) : flags.preventPvP });
            form.toggle('Prevent Hostile Damage (Players Only)', { defaultValue: restoredValues ? (restoredValues[6] as boolean) : flags.preventHostileDamage });
            form.toggle('Prevent Hostile Mob Spawning (Non-Players)', { defaultValue: restoredValues ? (restoredValues[7] as boolean) : flags.preventHostileMobSpawning });
            form.toggle('Prevent Block Breaking (Players Only)', { defaultValue: restoredValues ? (restoredValues[8] as boolean) : flags.preventBlockBreaking });
            form.toggle('Prevent Block Placing (Players Only)', { defaultValue: restoredValues ? (restoredValues[9] as boolean) : flags.preventBlockPlacing });
            form.toggle('Prevent Explosions (All Entities)', { defaultValue: restoredValues ? (restoredValues[10] as boolean) : flags.preventExplosions });
            form.toggle('Prevent Block Interaction (Players Only)', { defaultValue: restoredValues ? (restoredValues[11] as boolean) : flags.preventBlockInteraction });
            form.toggle('Prevent Item Pickup (Players Only)', { defaultValue: restoredValues ? (restoredValues[12] as boolean) : flags.preventItemPickup });
            form.toggle('Prevent Fall Damage (All Entities)', { defaultValue: restoredValues ? (restoredValues[13] as boolean) : flags.preventFallDamage });
            form.toggle('Prevent Magic Damage (All Entities)', { defaultValue: restoredValues ? (restoredValues[14] as boolean) : flags.preventMagicDamage });
            form.toggle('Prevent Mob Griefing (Non-Players)', { defaultValue: restoredValues ? (restoredValues[15] as boolean) : flags.preventMobGriefing });
            form.toggle('Prevent Entity Interaction (Players Only)', { defaultValue: restoredValues ? (restoredValues[16] as boolean) : flags.preventEntityInteraction });
            form.toggle('Prevent Projectile Usage (Players Only)', { defaultValue: restoredValues ? (restoredValues[17] as boolean) : flags.preventProjectileUsage });

            if (isEdit) {
                form.toggle('§cDelete Zone§r', { defaultValue: restoredValues ? (restoredValues[18] as boolean) : false });
            }

            return Promise.resolve(form);
        }
        return Promise.resolve(undefined);
    }

    async handleResponse(player: mc.Player, panelId: string, response: ActionFormResponse | ModalFormResponse, context: UIContext): Promise<void> {
        if (response.canceled) return Promise.resolve();

        if (panelId === 'worldProtectionListPanel') {
            const actionResponse = response as ActionFormResponse;
            if (typeof actionResponse.selection === 'number') {
                const items = await this.getItems(player, panelId, context);
                if (items && actionResponse.selection >= 0 && actionResponse.selection < items.length) {
                    const item = items[actionResponse.selection];
                    if (item && item.actionType === 'openPanel') {
                        return showPanel(player, item.actionValue, {
                            ...context,
                            page: 1,
                            selectedItemId: item.id
                        });
                    }
                }
            }
            return Promise.resolve();
        }

        const modalResponse = response as ModalFormResponse;
        if (!modalResponse.formValues) return Promise.resolve();

        if (panelId === 'addWorldProtectionPanel' || panelId === 'editWorldProtectionPanel') {
            const isEdit = panelId === 'editWorldProtectionPanel';
            const values = modalResponse.formValues;

            const newId = (values[0] as string).trim();
            const newName = (values[1] as string).trim();
            const dimensions = [MinecraftDimensionTypes.Overworld, MinecraftDimensionTypes.Nether, MinecraftDimensionTypes.TheEnd];
            const dimension = dimensions[values[2] as number] as string;

            const pos1Str = (values[3] as string).trim();
            const pos2Str = (values[4] as string).trim();

            const parseCoords = (str: string) => {
                const parts = str.split(/[,\s]+/).map((p) => parseFloat(p));
                if (parts.length >= 3 && !isNaN(parts[0]!) && !isNaN(parts[1]!) && !isNaN(parts[2]!)) {
                    return { x: parts[0]!, y: parts[1]!, z: parts[2]! };
                }
                return null;
            };

            const pos1 = parseCoords(pos1Str);
            const pos2 = parseCoords(pos2Str);

            // Validation
            if (!newId || !newName || !pos1 || !pos2) {
                player.sendMessage('§cInvalid input. Please ensure coordinates are formatted correctly (x y z) and ID/Name are provided.');
                // Re-open with values preserved
                return showPanel(player, panelId, { ...context, formValues: values });
            }

            const minX = Math.min(pos1.x, pos2.x);
            const minY = Math.min(pos1.y, pos2.y);
            const minZ = Math.min(pos1.z, pos2.z);

            const maxX = Math.max(pos1.x, pos2.x);
            const maxY = Math.max(pos1.y, pos2.y);
            const maxZ = Math.max(pos1.z, pos2.z);

            const flags = {
                preventPvP: values[5] as boolean,
                preventHostileDamage: values[6] as boolean,
                preventHostileMobSpawning: values[7] as boolean,
                preventBlockBreaking: values[8] as boolean,
                preventBlockPlacing: values[9] as boolean,
                preventExplosions: values[10] as boolean,
                preventBlockInteraction: values[11] as boolean,
                preventItemPickup: values[12] as boolean,
                preventFallDamage: values[13] as boolean,
                preventMagicDamage: values[14] as boolean,
                preventMobGriefing: values[15] as boolean,
                preventEntityInteraction: values[16] as boolean,
                preventProjectileUsage: values[17] as boolean
            };

            const config = getWorldProtectionConfig();

            if (isEdit) {
                const isDelete = values[18] as boolean;
                const oldZoneId = context.selectedItemId!.replace('zone_', '');

                if (isDelete) {
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
                            flags
                        };
                        player.sendMessage(`§aUpdated protection zone: ${newName}`);
                    }
                }
            } else {
                if (config.zones.some((z) => z.id === newId)) {
                    player.sendMessage(`§cZone ID '${newId}' already exists.`);
                    return Promise.resolve();
                }
                config.zones.push({
                    id: newId,
                    name: newName,
                    dimension,
                    box: {
                        min: { x: minX, y: minY, z: minZ },
                        max: { x: maxX, y: maxY, z: maxZ }
                    },
                    flags
                });
                player.sendMessage(`§aCreated new protection zone: ${newName}`);
            }

            saveWorldProtectionConfig(config);

            // Re-open the list panel
            void showPanel(player, 'worldProtectionListPanel', context);
        }
        return Promise.resolve();
    }
}
