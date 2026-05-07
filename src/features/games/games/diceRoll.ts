import * as mc from '@minecraft/server';
import { IGame } from '../types.js';

export class DiceRollGame implements IGame {
    id = 'diceRoll';
    name = 'Dice Roll';
    description = 'Roll a 6-sided dice.';
    minPlayers = 1;
    maxPlayers = 1;

    start(players: mc.Player[]) {
        const player = players[0];
        if (!player) return;

        const roll = Math.floor(Math.random() * 6) + 1;
        mc.world.sendMessage(`§a[Dice] §e${player.name}§r rolled a §l§b${roll}§r!`);
        player.playSound('random.orb', { pitch: 0.5 + roll / 10 });
    }

    stop() {
        // Stateless
    }
}
