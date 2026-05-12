import * as mc from '@minecraft/server';
import { ActionFormData, ActionFormResponse, ModalFormData, ModalFormResponse } from '@minecraft/server-ui';

import { getWorldProtectionConfig, saveWorldProtectionConfig } from '@core/configurations.js';
import { showPanel } from '@core/uiManager.js';
import { IPanelHandler, PanelItem, UIContext } from '@core/ui/types.js';
import { WorldProtectionZone } from '../worldProtectionConfig.default.js';

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
                    permissionLevel: 1,
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
                    permissionLevel: 1,
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
                zone = config.zones.find(z => z.id === zoneId);
                if (!zone) return Promise.resolve(undefined);
            }

            const form = new ModalFormData();
            form.title(isEdit ? `Edit Zone: ${zone?.name}` : 'Add Protection Zone');

            form.textField('Zone ID/Name (No spaces recommended)', 'e.g., spawn_city', { defaultValue: zone?.id ?? '' });
            form.textField('Display Name', 'e.g., Spawn City', { defaultValue: zone?.name ?? '' });

            const dimensions = ['minecraft:overworld', 'minecraft:nether', 'minecraft:the_end'];
            const dimIndex = zone ? Math.max(0, dimensions.indexOf(zone.dimension)) : 0;
            form.dropdown('Dimension', dimensions, { defaultValueIndex: dimIndex });

            // Coordinates
            form.textField('Min X', 'e.g., -100', { defaultValue: zone?.box.min.x.toString() ?? '' });
            form.textField('Min Y', 'e.g., -64', { defaultValue: zone?.box.min.y.toString() ?? '-64' });
            form.textField('Min Z', 'e.g., -100', { defaultValue: zone?.box.min.z.toString() ?? '' });

            form.textField('Max X', 'e.g., 100', { defaultValue: zone?.box.max.x.toString() ?? '' });
            form.textField('Max Y', 'e.g., 320', { defaultValue: zone?.box.max.y.toString() ?? '320' });
            form.textField('Max Z', 'e.g., 100', { defaultValue: zone?.box.max.z.toString() ?? '' });

            // Flags
            const flags = zone?.flags ?? {
                preventPvP: false,
                preventHostileDamage: false,
                preventHostileMobSpawning: false,
                preventBlockBreaking: false,
                preventBlockPlacing: false,
                preventExplosions: false,
                preventBlockInteraction: false
            };

            form.toggle('Prevent PvP', { defaultValue: flags.preventPvP });
            form.toggle('Prevent Hostile Damage', { defaultValue: flags.preventHostileDamage });
            form.toggle('Prevent Hostile Mob Spawning', { defaultValue: flags.preventHostileMobSpawning });
            form.toggle('Prevent Block Breaking', { defaultValue: flags.preventBlockBreaking });
            form.toggle('Prevent Block Placing', { defaultValue: flags.preventBlockPlacing });
            form.toggle('Prevent Explosions', { defaultValue: flags.preventExplosions });
            form.toggle('Prevent Block Interaction', { defaultValue: flags.preventBlockInteraction });

            if (isEdit) {
                form.toggle('§cDelete Zone§r', { defaultValue: false });
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
            const dimensions = ['minecraft:overworld', 'minecraft:nether', 'minecraft:the_end'];
            const dimension = dimensions[values[2] as number] as string;

            const minX = parseFloat(values[3] as string);
            const minY = parseFloat(values[4] as string);
            const minZ = parseFloat(values[5] as string);

            const maxX = parseFloat(values[6] as string);
            const maxY = parseFloat(values[7] as string);
            const maxZ = parseFloat(values[8] as string);

            // Validation
            if (!newId || !newName || isNaN(minX) || isNaN(minY) || isNaN(minZ) || isNaN(maxX) || isNaN(maxY) || isNaN(maxZ)) {
                player.sendMessage('§cInvalid input. Please ensure all coordinates are numbers and ID/Name are provided.');
                return Promise.resolve();
            }

            const flags = {
                preventPvP: values[9] as boolean,
                preventHostileDamage: values[10] as boolean,
                preventHostileMobSpawning: values[11] as boolean,
                preventBlockBreaking: values[12] as boolean,
                preventBlockPlacing: values[13] as boolean,
                preventExplosions: values[14] as boolean,
                preventBlockInteraction: values[15] as boolean
            };

            const config = getWorldProtectionConfig();

            if (isEdit) {
                const isDelete = values[16] as boolean;
                const oldZoneId = context.selectedItemId!.replace('zone_', '');

                if (isDelete) {
                    config.zones = config.zones.filter(z => z.id !== oldZoneId);
                    player.sendMessage(`§aDeleted protection zone: ${oldZoneId}`);
                } else {
                    const zoneIndex = config.zones.findIndex(z => z.id === oldZoneId);
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
                if (config.zones.some(z => z.id === newId)) {
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