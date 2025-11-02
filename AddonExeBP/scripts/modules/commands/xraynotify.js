import { getOrCreatePlayer, setPlayerXrayNotifications } from '../../core/playerDataManager.js';
import commandManager from './commandManager.js';
import { sendMessage } from '../../core/messaging.js';

commandManager.register('xraynotify', {
    aliases: ['xray'],
    description: 'Toggles X-ray notifications for yourself.',
    permissionLevel: 2,
    callback: (player, args) => {
        const pData = getOrCreatePlayer(player);
        const newStatus = !pData.xrayNotificationsEnabled;
        setPlayerXrayNotifications(player.id, newStatus);
        sendMessage(player, `§aX-ray notifications have been ${newStatus ? '§2enabled' : '§cdisabled'}§a.`);
    }
});
