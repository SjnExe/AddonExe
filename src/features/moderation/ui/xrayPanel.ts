import { getXrayConfig, saveXrayConfig } from '@core/configurations.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { MinecraftBlockTypes, MinecraftDimensionTypes } from '@minecraft/vanilla-data';
import { ActionFormBuilder } from '@ui/builders/ActionFormBuilder.js';
import { ModalFormBuilder } from '@ui/builders/ModalFormBuilder.js';

export async function showXrayOresPanel(player: mc.Player, page: number = 1): Promise<void> {
    const form = new ActionFormBuilder().title('X-Ray Ores Config').button('§l§2+ Add Ore', 'textures/ui/color_plus', async () => {
        await showAddXrayOrePanel(player);
    });

    const config = getXrayConfig();
    const oreKeys = Object.keys(config.monitoredOreTypes);

    form.addPaginatedButtons(
        oreKeys,
        page,
        (key, formBuilder) => {
            const ore = config.monitoredOreTypes[key];
            if (ore) {
                formBuilder.button(`${ore.oreName}\n${ore.enabled ? '§2[Enabled]' : '§4[Disabled]'}`, 'textures/blocks/diamond_ore', async () => {
                    await showEditXrayOrePanel(player, key);
                });
            }
        },
        async (newPage) => {
            await showXrayOresPanel(player, newPage);
        }
    );

    form.addBackButton(async () => {
        const { showConfigCategoryPanel } = await import('@core/ui/panels/configPanel.js');
        await showConfigCategoryPanel(player);
    });

    await form.show(player);
}

export async function showAddXrayOrePanel(player: mc.Player): Promise<void> {
    const modal = new ModalFormBuilder<{
        id: string;
        name: string;
        blockId: string;
        dimId: string;
        minY: string;
        maxY: string;
    }>()
        .title('Add X-Ray Ore')
        .textField('id', 'Internal ID (no spaces)', 'diamond')
        .textField('name', 'Display Name', 'Diamond Ore')
        .textField('blockId', 'Block ID', MinecraftBlockTypes.DiamondOre)
        .textField('dimId', 'Dimension', MinecraftDimensionTypes.Overworld)
        .textField('minY', 'Min Y', '-64')
        .textField('maxY', 'Max Y', '16');

    const res = await modal.show(player);
    if (!res) {
        await showXrayOresPanel(player, 1);
        return;
    }

    if (isNonEmptyString(res.id) && isNonEmptyString(res.name) && isNonEmptyString(res.blockId) && isNonEmptyString(res.minY) && isNonEmptyString(res.maxY)) {
        const config = getXrayConfig();
        config.monitoredOreTypes[res.id] = {
            enabled: true,
            oreName: res.name,
            blocks: [
                {
                    blockId: res.blockId,
                    dimensionId: isNonEmptyString(res.dimId) ? res.dimId : MinecraftDimensionTypes.Overworld,
                    minY: Number.parseInt(res.minY) || -64,
                    maxY: Number.parseInt(res.maxY) || 320
                }
            ]
        };
        saveXrayConfig(config);
        player.sendMessage('§aOre added.');
    }
    await showXrayOresPanel(player, 1);
}

export async function showEditXrayOrePanel(player: mc.Player, key: string): Promise<void> {
    const config = getXrayConfig();
    const ore = config.monitoredOreTypes[key];
    if (!isDefined(ore)) {
        await showXrayOresPanel(player, 1);
        return;
    }

    const block = ore.blocks[0] ?? { blockId: '', dimensionId: MinecraftDimensionTypes.Overworld, minY: -64, maxY: 320 };

    const modal = new ModalFormBuilder<{
        enabled: boolean;
        name: string;
        blockId: string;
        dimId: string;
        minY: string;
        maxY: string;
    }>()
        .title(`Edit ${ore.oreName}`)
        .toggle('enabled', 'Enabled', ore.enabled)
        .textField('name', 'Display Name', 'Name', ore.oreName)
        .textField('blockId', 'Block ID', 'ID', block.blockId)
        .textField('dimId', 'Dimension', 'ID', block.dimensionId)
        .textField('minY', 'Min Y', 'Y', String(block.minY))
        .textField('maxY', 'Max Y', 'Y', String(block.maxY));

    const res = await modal.show(player);
    if (!res) {
        await showXrayOresPanel(player, 1);
        return;
    }

    config.monitoredOreTypes[key]!.enabled = res.enabled;
    config.monitoredOreTypes[key]!.oreName = res.name;
    config.monitoredOreTypes[key]!.blocks[0] = {
        blockId: res.blockId,
        dimensionId: res.dimId,
        minY: Number.parseInt(res.minY) || -64,
        maxY: Number.parseInt(res.maxY) || 320
    };
    saveXrayConfig(config);
    player.sendMessage('§aOre updated.');

    await showXrayOresPanel(player, 1);
}
