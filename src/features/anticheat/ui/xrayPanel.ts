import { getXrayConfig, saveXrayConfig } from '@core/config/configurations.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { MinecraftBlockTypes, MinecraftDimensionTypes } from '@minecraft/vanilla-data';
import { ActionFormBuilder } from '@ui/builders/actionFormBuilder.js';
import { CustomFormBuilder } from '@ui/builders/customFormBuilder.js';
import { showConfirmationDialog } from '@ui/components.js';

const dimensionOptions = [
  MinecraftDimensionTypes.Overworld,
  MinecraftDimensionTypes.Nether,
  MinecraftDimensionTypes.TheEnd,
];

export async function showXrayOresPanel(player: mc.Player, page: number = 1): Promise<void> {
  const form = new ActionFormBuilder()
    .title('X-Ray Ores Config')
    .button('§l§2+ Add Ore', 'textures/ui/color_plus', async () => {
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
        formBuilder.button(
          `${ore.oreName} (${ore.blocks.length} block${ore.blocks.length === 1 ? '' : 's'})\n${ore.enabled ? '§2[Enabled]' : '§4[Disabled]'}`,
          'textures/blocks/diamond_ore',
          async () => {
            await showEditXrayOrePanel(player, key);
          },
        );
      }
    },
    async (newPage) => {
      await showXrayOresPanel(player, newPage);
    },
  );

  form.addBackButton(async () => {
    const { showConfigCategoryPanel } = await import('@core/ui/panels/configPanel.js');
    await showConfigCategoryPanel(player);
  });

  await form.show(player);
}

export async function showAddXrayOrePanel(player: mc.Player): Promise<void> {
  const modal = new CustomFormBuilder<{
    id: string;
    name: string;
    blockId: string;
    dimId: string;
    minY: string;
    maxY: string;
  }>('Add X-Ray Ore')
    .textField('id', 'Internal ID (no spaces)', 'diamond', '')
    .textField('name', 'Display Name', 'Diamond Ore', '')
    .textField('blockId', 'Block ID', MinecraftBlockTypes.DiamondOre, MinecraftBlockTypes.DiamondOre)
    .dropdown('dimId', 'Dimension', dimensionOptions, 0)
    .textField('minY', 'Min Y', '-64', '-64')
    .textField('maxY', 'Max Y', '16', '16')
    .submitButton('Add Ore');

  const res = await modal.show(player);
  if (!res) {
    await showXrayOresPanel(player, 1);
    return;
  }

  if (
    isNonEmptyString(res.id) &&
    isNonEmptyString(res.name) &&
    isNonEmptyString(res.blockId) &&
    isNonEmptyString(res.minY) &&
    isNonEmptyString(res.maxY)
  ) {
    const config = getXrayConfig();
    config.monitoredOreTypes[res.id.trim()] = {
      enabled: true,
      oreName: res.name.trim(),
      blocks: [
        {
          blockId: res.blockId.trim(),
          dimensionId: isNonEmptyString(res.dimId) ? res.dimId : MinecraftDimensionTypes.Overworld,
          minY: Number.isNaN(Number.parseInt(res.minY)) ? -64 : Number.parseInt(res.minY),
          maxY: Number.isNaN(Number.parseInt(res.maxY)) ? 320 : Number.parseInt(res.maxY),
        },
      ],
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

  const form = new ActionFormBuilder()
    .title(`Ore: ${ore.oreName}`)
    .body(
      `§7Key: §f${key}\n§7Status: ${ore.enabled ? '§2Enabled' : '§4Disabled'}\n§7Monitored Block Rules: §f${ore.blocks.length}`,
    )
    .button(
      ore.enabled ? '§4Disable Ore Alerts' : '§2Enable Ore Alerts',
      ore.enabled ? 'textures/ui/cancel' : 'textures/ui/realms_green_check',
      async () => {
        ore.enabled = !ore.enabled;
        saveXrayConfig(config);
        player.sendMessage(`§a${ore.oreName} alerts ${ore.enabled ? 'enabled' : 'disabled'}.`);
        await showEditXrayOrePanel(player, key);
      },
    )
    .button('Rename Ore Display Name', 'textures/ui/book_edit_default', async () => {
      const modal = new CustomFormBuilder<{ name: string }>(`Rename ${ore.oreName}`)
        .textField('name', 'Display Name', 'Diamond Ore', ore.oreName)
        .submitButton('Save Name');
      const res = await modal.show(player);
      if (res && isNonEmptyString(res.name)) {
        ore.oreName = res.name.trim();
        saveXrayConfig(config);
        player.sendMessage('§aOre display name updated.');
      }
      await showEditXrayOrePanel(player, key);
    })
    .button('§2+ Add Block Rule', 'textures/ui/color_plus', async () => {
      await showEditXrayBlockRuleModal(player, key);
    });

  ore.blocks.forEach((b, idx) => {
    form.button(
      `§e${b.blockId.replace(/^minecraft:/, '')}\n§7${b.dimensionId.replace(/^minecraft:/, '')} | Y: ${b.minY} to ${b.maxY}`,
      'textures/blocks/diamond_ore',
      async () => {
        await showEditXrayBlockRuleModal(player, key, idx);
      },
    );
  });

  form.button('§4Delete Monitored Ore', 'textures/ui/trash', async () => {
    await showConfirmationDialog(player, {
      title: `Delete ${ore.oreName}`,
      body: `Are you sure you want to delete monitored ore '${ore.oreName}' (${key})?`,
      confirmButtonText: '§4Delete',
      onConfirm: async () => {
        delete config.monitoredOreTypes[key];
        saveXrayConfig(config);
        player.sendMessage(`§aDeleted monitored ore '${ore.oreName}'.`);
        await showXrayOresPanel(player, 1);
      },
      onCancel: async () => {
        await showEditXrayOrePanel(player, key);
      },
    });
  });

  form.addBackButton(async () => {
    await showXrayOresPanel(player, 1);
  });

  await form.show(player);
}

async function showEditXrayBlockRuleModal(player: mc.Player, key: string, blockIndex?: number): Promise<void> {
  const config = getXrayConfig();
  const ore = config.monitoredOreTypes[key];
  if (!isDefined(ore)) {
    await showXrayOresPanel(player, 1);
    return;
  }

  const isEdit = isDefined(blockIndex) && isDefined(ore.blocks[blockIndex]);
  const block = isEdit
    ? ore.blocks[blockIndex]!
    : { blockId: MinecraftBlockTypes.DiamondOre, dimensionId: MinecraftDimensionTypes.Overworld, minY: -64, maxY: 16 };
  const dimIdx = Math.max(0, dimensionOptions.indexOf(block.dimensionId as MinecraftDimensionTypes));

  const modal = new CustomFormBuilder<{
    blockId: string;
    dimId: string;
    minY: string;
    maxY: string;
    deleteRule?: boolean;
  }>(isEdit ? `Edit Block Rule #${blockIndex! + 1}` : `Add Block to ${ore.oreName}`)
    .textField('blockId', 'Block ID', MinecraftBlockTypes.DiamondOre, block.blockId)
    .dropdown('dimId', 'Dimension', dimensionOptions, dimIdx)
    .textField('minY', 'Min Y', '-64', String(block.minY))
    .textField('maxY', 'Max Y', '16', String(block.maxY));

  if (isEdit && ore.blocks.length > 1) {
    modal.toggle('deleteRule', '§cRemove this block rule', false);
  }

  modal.submitButton('Save Rule');

  const res = await modal.show(player);
  if (!res) {
    await showEditXrayOrePanel(player, key);
    return;
  }

  if (isEdit && res.deleteRule && isDefined(blockIndex)) {
    ore.blocks.splice(blockIndex, 1);
    saveXrayConfig(config);
    player.sendMessage('§aRemoved block rule.');
    await showEditXrayOrePanel(player, key);
    return;
  }

  const updatedBlock = {
    blockId: res.blockId.trim() || block.blockId,
    dimensionId: isNonEmptyString(res.dimId) ? res.dimId : MinecraftDimensionTypes.Overworld,
    minY: Number.isNaN(Number.parseInt(res.minY)) ? -64 : Number.parseInt(res.minY),
    maxY: Number.isNaN(Number.parseInt(res.maxY)) ? 320 : Number.parseInt(res.maxY),
  };

  if (isEdit && isDefined(blockIndex)) {
    ore.blocks[blockIndex] = updatedBlock;
  } else {
    ore.blocks.push(updatedBlock);
  }

  saveXrayConfig(config);
  player.sendMessage('§aSaved X-Ray block rule.');
  await showEditXrayOrePanel(player, key);
}
