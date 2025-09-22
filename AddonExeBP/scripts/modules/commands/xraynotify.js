import { commandManager } from './commandManager.js';
import { getPlayer, setPlayerXrayNotifications } from '../../core/playerDataManager.js';
import { addAdminToXrayCache, removeAdminFromXrayCache } from '../../core/playerCache.js';

commandManager.register({
    name: 'xraynotify',
    description: 'Toggles X-Ray notifications for yourself.',
    category: '§4Administration',
    permissionLevel: 2, // Admin and above
    parameters: [],
    execute: (player, args) => {
        const pData = getPlayer(player.id);
        if (!pData) {
            player.sendMessage('§cCould not find your player data.');
            return;
        }

        const newStatus = !pData.xrayNotifications;
        setPlayerXrayNotifications(player.id, newStatus);

        if (newStatus) {
            addAdminToXrayCache(player.id);
        } else {
            removeAdminFromXrayCache(player.id);
        }

        const status = newStatus ? '§aenabled' : '§cdisabled';
        player.sendMessage(`§aX-Ray notifications have been ${status}§a for you.`);
    }
});
