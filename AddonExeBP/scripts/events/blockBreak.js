import * as playerCache from '../core/playerCache.js';

export const eventName = 'blockBreak';

function handleBlockBreak(event) {
    const { brokenBlock, player } = event;
    const valuableOres = [
        'minecraft:diamond_ore',
        'minecraft:deepslate_diamond_ore',
        'minecraft:ancient_debris'
    ];

    if (valuableOres.includes(brokenBlock.typeId)) {
        const onlineAdmins = playerCache.getXrayAdmins();
        if (onlineAdmins.length === 0) { return; }

        const location = brokenBlock.location;
        const message = `§e${player.name}§r mined §e${brokenBlock.typeId.replace('minecraft:', '')}§r at §bX: ${Math.floor(location.x)}, Y: ${Math.floor(location.y)}, Z: ${Math.floor(location.z)}`;

        onlineAdmins.forEach(admin => {
            if (admin.id !== player.id) {
                admin.sendMessage(message);
            }
        });
    }
}

export default handleBlockBreak;