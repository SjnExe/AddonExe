import { getConfig } from '@core/configManager.js';
import { loadPlayerData } from '@core/playerDataManager.js';
import { showPanel } from '@core/uiManager.js';
import * as tpaManager from '@features/teleport/tpaManager.js';
import * as mc from '@minecraft/server';
import { ActionFormBuilder } from '@ui/builders/ActionFormBuilder.js';

export async function showTpaSettingsPanel(player: mc.Player): Promise<void> {
    const form = new ActionFormBuilder().title('TPA Settings');
    const pData = loadPlayerData(player.id);
    const config = getConfig();

    if (!config.tpa.enabled) {
        form.button('§4System Globally Disabled', 'textures/ui/warning_alert', async () => {
            await showTpaSettingsPanel(player);
        });
    }

    const isEnabled = !(pData?.tpaRequestsDisabled ?? false);
    form.button(isEnabled ? '§2Incoming Requests: Allowed' : '§4Incoming Requests: Blocked', isEnabled ? 'textures/ui/realms_green_check' : 'textures/ui/cancel', async () => {
        const newState = tpaManager.toggleTpaRequests(player);
        player.sendMessage(`§aTPA Requests are now ${newState ? '§4Disabled' : '§2Enabled'}.`);
        await showTpaSettingsPanel(player);
    });

    form.button('Blocked Players', 'textures/ui/icon_multiplayer', async () => {
        await showTpaBlockListPanel(player);
    });

    form.addBackButton(async () => {
        await showPanel(player, 'profileMainPanel');
    });

    await form.show(player);
}

export async function showTpaBlockListPanel(player: mc.Player, page: number = 1): Promise<void> {
    const form = new ActionFormBuilder().title('Blocked Players');
    const pData = loadPlayerData(player.id);
    const blocked = pData?.tpaBlockedPlayerIds ?? [];

    if (blocked.length === 0) {
        form.body('You have not blocked any players.');
    }

    form.addPaginatedButtons(
        blocked,
        page,
        (id, formBuilder) => {
            const name = loadPlayerData(id)?.name ?? id;
            formBuilder.button(`Unblock ${name}`, undefined, async () => {
                tpaManager.unblockPlayer(player, id);
                player.sendMessage(`§aPlayer unblocked.`);
                await showTpaBlockListPanel(player, page);
            });
        },
        async (newPage) => {
            await showTpaBlockListPanel(player, newPage);
        }
    );

    form.addBackButton(async () => {
        await showTpaSettingsPanel(player);
    });

    await form.show(player);
}
