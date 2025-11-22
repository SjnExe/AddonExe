import * as playerCache from '../playerCache.js';
import { getPlayer } from '../playerDataManager.js';
import { getXrayConfig } from '../../core/configurations.js';
import { infoLog } from '../../core/logger.js';

/**
 * Handles the `playerBreakBlock` event to notify admins of valuable ore mining.
 * @param {import('@minecraft/server').PlayerBreakBlockAfterEvent} event The event data.
 */
function handlePlayerBreakBlock(event) {
    const { block, player } = event;
    const config = getXrayConfig();

    // If monitoring is disabled globally, exit
    if (!config.enabled) { return; }

    // Check if the block is monitored
    const monitoredBlock = config.monitoredOreTypes.find(ore => ore.blockId === block.typeId);
    if (!monitoredBlock || !monitoredBlock.enabled) { return; }

    // Format the notification message
    const location = block.location;
    const message = `§e${player.name}§r mined §e${block.typeId.replace('minecraft:', '')}§r at §bX: ${location.x.toFixed(2)}, Y: ${location.y.toFixed(2)}, Z: ${location.z.toFixed(2)}`;

    // 1. Console Logging
    if (config.notifications.logToConsole) {
        infoLog(`[X-Ray] ${player.name} mined ${block.typeId} at ${location.x},${location.y},${location.z}`);
    }

    // 2. Notify Online Staff
    // Filter for admins/owners (permission level <= 1) who have notifications enabled
    const onlineAdmins = playerCache.getAllPlayersFromCache().filter(p => {
        const pData = getPlayer(p.id);
        // Only notify admins/mods (level 1 or 0) or whoever is configured as staff
        // Assuming level 1 is admin, 0 is owner.
        const isStaff = pData && pData.permissionLevel <= 1;
        return isStaff && pData.xrayNotificationsEnabled;
    });

    onlineAdmins.forEach(admin => {
        // Don't notify the player about their own mining (optional, but usually desired to avoid spam)
        if (admin.id !== player.id) {
            admin.sendMessage(message);
        }
    });
}

export default handlePlayerBreakBlock;
