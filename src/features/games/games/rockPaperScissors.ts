import { getGamesConfig } from '@core/configurations.js';
import { incrementPlayerBalance } from '@core/playerDataManager.js';
import { uiWait } from '@core/utils.js';
import { isDefined } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { ActionFormData, ActionFormResponse } from '@minecraft/server-ui';
import { IGame } from '../types.js';

type Choice = 'Rock' | 'Paper' | 'Scissors';

interface Match {
    p1Id: string;
    p1Name: string;
    p2Id: string;
    p2Name: string;
    p1Choice: Choice | null;
    p2Choice: Choice | null;
    isAI: boolean;
}

export class RockPaperScissorsGame implements IGame {
    id = 'rockPaperScissors';
    name = 'Rock Paper Scissors';
    description = 'Classic hand game.';
    minPlayers = 1;
    maxPlayers = 2;

    private readonly matches = new Map<string, Match>();

    start(players: mc.Player[], config: Record<string, unknown>) {
        const p1 = players[0];
        if (!isDefined(p1)) return;

        if (this.matches.has(p1.id)) {
            void this.openUI(p1);
            return;
        }

        const opponent = config.opponent instanceof mc.Player ? config.opponent : undefined;
        const isAI = !isDefined(opponent);
        const p2Id = isDefined(opponent) ? opponent.id : 'AI';
        const p2Name = isDefined(opponent) ? opponent.name : 'Bot';

        const match: Match = {
            p1Id: p1.id,
            p1Name: p1.name,
            p2Id: p2Id,
            p2Name: p2Name,
            p1Choice: null,
            p2Choice: null,
            isAI
        };

        this.matches.set(p1.id, match);
        if (!isAI) this.matches.set(p2Id, match);

        void this.openUI(p1);
        if (!isAI && isDefined(opponent)) {
            void this.openUI(opponent);
        }
    }

    stop() {
        this.matches.clear();
    }

    async openUI(player: mc.Player) {
        const match = this.matches.get(player.id);
        if (!isDefined(match)) return;

        const isP1 = player.id === match.p1Id;
        const myChoice = isP1 ? match.p1Choice : match.p2Choice;
        const opponentChoice = isP1 ? match.p2Choice : match.p1Choice;
        const opponentName = isP1 ? match.p2Name : match.p1Name;

        const form = new ActionFormData()
            .title(`RPS vs ${opponentName}`)
            .body(
                `Your opponent is ${isDefined(opponentChoice) ? '§aREADY' : '§eTHINKING'}...\n\n` +
                    (isDefined(myChoice) ? `You picked: §b${myChoice}§r` : 'Choose your move:')
            );

        if (isDefined(myChoice)) {
            form.button('Refresh / Wait Result');
        } else {
            form.button('Rock', 'textures/items/coal');
            form.button('Paper', 'textures/items/paper');
            form.button('Scissors', 'textures/items/shears');
        }

        const res = await uiWait(player, form);
        if (!isDefined(res) || res.canceled) return;
        const response = res as ActionFormResponse;

        if (isDefined(response.selection)) {
            if (isDefined(myChoice)) {
                // Refresh
                this.checkResult(match);
                void this.openUI(player);
            } else {
                const choices: Choice[] = ['Rock', 'Paper', 'Scissors'];
                const picked = choices[response.selection];
                if (isDefined(picked)) {
                    if (isP1) match.p1Choice = picked;
                    else match.p2Choice = picked;

                    if (match.isAI) {
                        const randomChoice = choices[Math.floor(Math.random() * 3)];
                        if (isDefined(randomChoice)) {
                            match.p2Choice = randomChoice;
                        }
                    }

                    this.checkResult(match);
                    void this.openUI(player); // Re-open to show result
                }
            }
        }
    }

    private checkResult(match: Match) {
        if (isDefined(match.p1Choice) && isDefined(match.p2Choice)) {
            // Both picked
            const p1 = match.p1Choice;
            const p2 = match.p2Choice;

            let winner: 'p1' | 'p2' | 'draw' = 'draw';

            if (p1 === p2) winner = 'draw';
            else if (
                (p1 === 'Rock' && p2 === 'Scissors') ||
                (p1 === 'Paper' && p2 === 'Rock') ||
                (p1 === 'Scissors' && p2 === 'Paper')
            ) {
                winner = 'p1';
            } else {
                winner = 'p2';
            }

            this.announceWinner(match, winner);
            this.cleanupMatch(match);
        }
    }

    private announceWinner(match: Match, winner: 'p1' | 'p2' | 'draw') {
        const p1 = mc.world.getAllPlayers().find((p) => p.id === match.p1Id);
        const p2 = match.isAI ? null : mc.world.getAllPlayers().find((p) => p.id === match.p2Id);

        const gamesConfig = getGamesConfig();
        const rpsConfig = gamesConfig.rockPaperScissors;
        const reward = rpsConfig.rewards.money;
        const p1Msg = `§e${match.p1Name}§r chose §b${match.p1Choice}§r`;
        const p2Msg = `§e${match.p2Name}§r chose §b${match.p2Choice}§r`;

        const resultMsg = `\n${p1Msg}\n${p2Msg}\n\n`;

        if (winner === 'draw') {
            if (isDefined(p1)) p1.sendMessage(`§eIt's a Draw!${resultMsg}`);
            if (isDefined(p2)) p2.sendMessage(`§eIt's a Draw!${resultMsg}`);
        } else if (winner === 'p1') {
            if (isDefined(p1)) {
                p1.sendMessage(`§aYou Won!${resultMsg}`);
                incrementPlayerBalance(p1.id, reward);
                p1.sendMessage(`§a+${reward}`);
            }
            if (isDefined(p2)) p2.sendMessage(`§cYou Lost!${resultMsg}`);
        } else {
            if (isDefined(p1)) p1.sendMessage(`§cYou Lost!${resultMsg}`);
            if (isDefined(p2)) {
                p2.sendMessage(`§aYou Won!${resultMsg}`);
                incrementPlayerBalance(p2.id, reward);
                p2.sendMessage(`§a+${reward}`);
            }
        }
    }

    private cleanupMatch(match: Match) {
        this.matches.delete(match.p1Id);
        if (!match.isAI) this.matches.delete(match.p2Id);
    }
}

export const rockPaperScissors = new RockPaperScissorsGame();
