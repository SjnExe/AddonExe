import * as playerCache from '../playerCache.js';

/**
 * Handles the `playerBreakBlock` event to notify admins of valuable ore mining.
 * @param {import('@minecraft/server').PlayerBreakBlockAfterEvent} event The event data.
 */
function handlePlayerBreakBlock(event) {
    // The event properties are `player` and `block` for `playerBreakBlock`.
    const { block, player } = event;
    const valuableOres = [
        'minecraft:diamond_ore',
        'minecraft:deepslate_diamond_ore',
        'minecraft:ancient_debris'
    ];

    if (valuableOres.includes(block.typeId)) {
        const onlineAdmins = playerCache.getXrayAdmins();
        if (onlineAdmins.length === 0) { return; }

        const location = block.location;
        const message = `§e${player.name}§r mined §e${block.typeId.replace('minecraft:', '')}§r at §bX: ${Math.floor(location.x)}, Y: ${Math.floor(location.y)}, Z: ${Math.floor(location.z)}`;

        onlineAdmins.forEach(admin => {
            // Don't send the notification to the player who mined the ore.
            if (admin.id !== player.id) {
                admin.sendMessage(message);
            }
        });
    }
}

export default handlePlayerBreakBlock;