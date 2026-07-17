import { showPanel } from '@core/uiManager.js';
import { isDefined } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { ActionFormBuilder } from '@ui/builders/ActionFormBuilder.js';
import { getStaticMenuItems } from '@ui/panelBuilder.js';
import { panelDefinitions, UIContext } from '@ui/panelRegistry.js';

export async function showGamesMainPanel(player: mc.Player, context: UIContext = {}): Promise<void> {
    const def = panelDefinitions['gamesMainPanel'];
    if (!isDefined(def)) return;

    const form = new ActionFormBuilder().title(def.title).body(def.body ?? '');
    const staticItems = getStaticMenuItems(player, def);

    for (const item of staticItems) {
        form.button(item.text, item.icon, async () => {
            if (item.actionType === 'openPanel') {
                return showPanel(player, item.actionValue, { ...context, page: 1 });
            }
            const { uiActionFunctions } = await import('@core/ui/actionRegistry.js');
            const action = uiActionFunctions[item.actionValue];
            if (isDefined(action)) {
                await action(player, context, 'gamesMainPanel');
            } else {
                player.sendMessage(`§cAction ${item.actionValue} not mapped.`);
            }
        });
    }

    form.addBackButton(async () => {
        await showPanel(player, 'mainPanel', context);
    });

    await form.show(player);
}

export async function showWordleMainPanel(player: mc.Player, context: UIContext = {}): Promise<void> {
    const def = panelDefinitions['wordleMainPanel'];
    if (!isDefined(def)) return;

    const form = new ActionFormBuilder().title(def.title).body(def.body ?? '');
    const staticItems = getStaticMenuItems(player, def);

    for (const item of staticItems) {
        form.button(item.text, item.icon, async () => {
            if (item.actionType === 'openPanel') {
                return showPanel(player, item.actionValue, { ...context, page: 1 });
            }
            const { uiActionFunctions } = await import('@core/ui/actionRegistry.js');
            const action = uiActionFunctions[item.actionValue];
            if (isDefined(action)) {
                await action(player, context, 'wordleMainPanel');
            } else {
                player.sendMessage(`§cAction ${item.actionValue} not mapped.`);
            }
        });
    }

    form.addBackButton(async () => {
        await showGamesMainPanel(player, context);
    });

    await form.show(player);
}
