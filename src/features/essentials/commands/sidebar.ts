import * as mc from '@minecraft/server';

import { CustomCommand } from '@commands/commandManager.js';
import { isFeatureActive } from '@core/featureManager.js';
import { getSidebarVisible, setSidebarLayout, setSidebarVisible } from '@core/playerDataManager.js';
import { forceUpdate } from '@features/sidebar/manager.js';
import { isNonEmptyString } from '@lib/guards.js';

const command: CustomCommand = {
    name: 'sidebar',
    description: 'Toggles your personal sidebar/HUD or changes its screen position.',
    aliases: ['sb'],
    permissionNode: 'cmd.sidebar.member',
    category: 'General',
    parameters: [
        {
            name: 'mode',
            type: 'string',
            optional: true,
            enumOptions: ['toggle', 'ui', 'right', 'left', 'bottom', 'default', 'on', 'off']
        }
    ],
    execute: async (executor, args: { mode?: string }) => {
        if (!(executor instanceof mc.Player)) {
            if ('sendMessage' in executor) {
                executor.sendMessage('§cOnly players can use this command.');
            }
            return;
        }

        const player = executor;

        if (!isFeatureActive('util.sidebar')) {
            player.sendMessage('§cThe Sidebar and HUD system is currently disabled globally by the server admin.');
            return;
        }

        const mode = isNonEmptyString(args.mode) ? args.mode.toLowerCase() : 'toggle';

        if (mode === 'ui' || mode === 'settings') {
            const { showPlayerSidebarSettingsPanel } = await import('@features/sidebar/ui/adminPanel.js');
            await showPlayerSidebarSettingsPanel(player);
            return;
        }

        if (mode === 'right' || mode === 'left' || mode === 'bottom' || mode === 'default') {
            setSidebarLayout(player.id, mode);
            setSidebarVisible(player.id, true);
            forceUpdate();
            player.sendMessage(`§aPersonal HUD layout set to §e${mode.toUpperCase()}§a.`);
            return;
        }

        const current = getSidebarVisible(player.id);
        const newState = mode === 'on' ? true : mode === 'off' ? false : !current;

        setSidebarVisible(player.id, newState);

        if (newState) {
            forceUpdate();
            player.sendMessage('§aPersonal HUD enabled. §7(Tip: Use §e/sidebar left§7, §e/sidebar right§7, §e/sidebar bottom§7, or §e/sidebar ui§7 to customize!)');
        } else {
            player.sendMessage('§cPersonal HUD disabled.');
            player.onScreenDisplay.setActionBar('');
        }
    }
};

export default command;
