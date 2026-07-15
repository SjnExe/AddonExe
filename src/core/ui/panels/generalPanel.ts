import { hasPermission } from '@core/permissionEngine.js';
import { showPanel } from '@core/uiManager.js';
import * as mc from '@minecraft/server';
import { ActionFormBuilder } from '@ui/builders/ActionFormBuilder.js';

import { getStaticMenuItems } from '@ui/panelBuilder.js';
import { panelDefinitions } from '@ui/panelRegistry.js';

export async function showMainPanel(player: mc.Player): Promise<void> {
    const form = new ActionFormBuilder().title('Main Menu');
    const def = panelDefinitions['mainPanel'];

    if (def) {
        const items = getStaticMenuItems(player, def);
        for (const item of items) {
            if (item.id === '__back__') continue;
            form.button(item.text, item.icon, async () => {
                if (item.actionType === 'openPanel') {
                    await showPanel(player, item.actionValue, { page: 1 });
                } else {
                    const { uiActionFunctions } = await import('@core/ui/actionRegistry.js');
                    const action = uiActionFunctions[item.actionValue];
                    if (action) await action(player, {}, 'mainPanel');
                }
            });
        }
    }

    form.addCloseButton();

    await form.show(player);
}

export async function showProfileMainPanel(player: mc.Player): Promise<void> {
    const form = new ActionFormBuilder().title('Profile');

    if (hasPermission(player, 'ui.panel.member')) {
        form.button('My Stats', 'textures/ui/profile_glyph_color.png', async () => {
            await showPanel(player, 'myStatsPanel');
        });
        form.button('TPA Settings', 'textures/items/ender_pearl', async () => {
            await showPanel(player, 'tpaSettingsPanel');
        });
    }

    form.addBackButton(async () => {
        await showMainPanel(player);
    });

    await form.show(player);
}

export async function showBountyListPanel(player: mc.Player): Promise<void> {
    const form = new ActionFormBuilder().title('Bounty List');
    const { getAllBounties } = await import('@features/economy/bountyManager.js');
    const { formatCurrency } = await import('@core/utils/economy.js');

    const bountiesMap = getAllBounties();
    const bounties = Array.from(bountiesMap.values());

    if (bounties.length === 0) {
        form.body('There are currently no active bounties.');
    } else {
        for (const bounty of bounties) {
            form.button(`${bounty.name}\n§6${formatCurrency(bounty.amount)}`, 'textures/items/netherite_sword', async () => {
                await showPanel(player, 'bountyActionsPanel', {
                    targetPlayerId: bounty.playerId,
                    targetPlayerName: bounty.name,
                    returnPanel: 'bountyListPanel',
                    customTitle: bounty.name
                });
            });
        }
    }

    form.addBackButton(async () => {
        await showMainPanel(player);
    });

    await form.show(player);
}

export async function showBountyActionsPanel(player: mc.Player, targetPlayerId: string, targetPlayerName: string): Promise<void> {
    const form = new ActionFormBuilder().title(targetPlayerName);

    if (hasPermission(player, 'ui.panel.member')) {
        form.button('Add Bounty', 'textures/items/netherite_sword', async () => {
            const { uiActionFunctions } = await import('@core/ui/actionRegistry.js');
            const action = uiActionFunctions['bountyPlayer'];
            if (action) await action(player, { targetPlayerId, targetPlayerName }, 'bountyActionsPanel');
        });
    }

    if (hasPermission(player, 'ui.panel.mod')) {
        form.button('Remove Bounty', 'textures/ui/cancel', async () => {
            const { uiActionFunctions } = await import('@core/ui/actionRegistry.js');
            const action = uiActionFunctions['removePlayerBounty'];
            if (action) await action(player, { targetPlayerId, targetPlayerName }, 'bountyActionsPanel');
        });
    }

    form.addBackButton(async () => {
        await showBountyListPanel(player);
    });

    await form.show(player);
}
