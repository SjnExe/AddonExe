import * as mc from '@minecraft/server';
import { getEconomyConfig } from './configurations.js';
import { incrementPlayerBalance } from './playerDataManager.js';
import { infoLog } from './logger.js';
import { formatCurrency } from './utils.js';

mc.world.afterEvents.entityDie.subscribe((event) => {
    const { deadEntity, damageSource } = event;
    const { damagingEntity } = damageSource;

    if (!damagingEntity || damagingEntity.typeId !== 'minecraft:player') {
        return;
    }

    const economyConfig = getEconomyConfig();
    if (!economyConfig || !economyConfig.mobMoney) {
        return;
    }

    const mobId = deadEntity.typeId;
    const reward = economyConfig.mobMoney[mobId];

    if (reward && reward > 0) {
        incrementPlayerBalance(damagingEntity.id, reward);
        infoLog(
            `Gave ${damagingEntity.name} ${formatCurrency(reward)} for killing a ${mobId}.`
        );
    }
});
