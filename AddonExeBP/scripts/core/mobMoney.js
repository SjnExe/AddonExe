import { system } from '@minecraft/server';
import { config } from '../config.js';
import { incrementPlayerBalance } from './playerDataManager.js';
import { infoLog } from './logger.js';

system.afterEvents.scriptEventReceive.subscribe(
    (event) => {
        const { id, sourceEntity, message } = event;

        if (id === 'addonexe:mob_killed') {
            if (!sourceEntity || sourceEntity.typeId !== 'minecraft:player') {
                return;
            }

            const mobId = message;
            const reward = config.mobMoney[mobId];

            if (reward && reward > 0) {
                incrementPlayerBalance(sourceEntity.id, reward);
                infoLog(
                    `Gave ${sourceEntity.name} $${reward} for killing a ${mobId}.`
                );
            }
        }
    },
    {
        namespaces: ['addonexe']
    }
);
