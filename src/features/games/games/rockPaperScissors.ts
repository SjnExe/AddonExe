import { getGamesConfig } from '@core/configurations.js';
import { incrementPlayerBalance } from '@core/playerDataManager.js';
import { uiWait } from '@core/utils.js';
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
        if (!p1) return;

        if (this.matches.has(p1.id)) {
            void this.openUI(p1);
            return;
        }

        const opponent = config?.opponent as mc.Player | undefined;
        const isAI = !opponent;
        const p2Id = isAI ? 'AI' : opponent.id;
        const p2Name = isAI ? 'Bot' : opponent.name;

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
        if (!isAI && opponent) {
            void this.openUI(opponent);
        }
    }

    stop() {
        this.matches.clear();
    }

    async openUI(player: mc.Player) {
        const match = this.matches.get(player.id);
        if (!match) return;

        const isP1 = player.id === match.p1Id;
        const myChoice = isP1 ? match.p1Choice : match.p2Choice;
        const opponentChoice = isP1 ? match.p2Choice : match.p1Choice;
        const opponentName = isP1 ? match.p2Name : match.p1Name;

        if (match.isAI && match.p2Choice === null) {
            // AI picks immediately when game starts?
            // Better: AI picks when player opens UI or when player picks.
            // Let's make AI pick when player picks to simulate instant response.
        }

        const form = new ActionFormData()
            .title(`RPS vs ${opponentName}`)
            .body(
                `Your opponent is ${opponentChoice ? '§aREADY' : '§eTHINKING'}...\n\n` +
                    (myChoice ? `You picked: §b${myChoice}§r` : 'Choose your move:')
            );

        if (myChoice) {
            form.button('Refresh / Wait Result');
        } else {
            form.button('Rock', 'textures/items/coal'); // Using coal as rock placeholder if needed, or default
            form.button('Paper', 'textures/items/paper');
            form.button('Scissors', 'textures/items/shears');
        }

        // Add Invite Button if it's a Bot match and we want to allow converting to PvP?
        // Or generic "Invite Friend" button if looking for opponent?
        // Current logic: start() is called with opponent.
        // If we want "Lobby" logic, we need a separate state.
        // For now, assume this UI is for the active match.

        const res = await uiWait(player, form);
        if (!res || res.canceled) return;
        const response = res as ActionFormResponse;

        if (response.selection !== undefined) {
            if (myChoice) {
                // Refresh
                this.checkResult(match);
                void this.openUI(player);
            } else {
                const choices: Choice[] = ['Rock', 'Paper', 'Scissors'];
                const picked = choices[response.selection];
                if (picked) {
                    if (isP1) match.p1Choice = picked;
                    else match.p2Choice = picked;

                    if (match.isAI) {
                        match.p2Choice = choices[Math.floor(Math.random() * 3)] as Choice;
                    }

                    this.checkResult(match);
                    void this.openUI(player); // Re-open to show result
                }
            }
        }
    }

    private checkResult(match: Match) {
        if (match.p1Choice && match.p2Choice) {
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
        const rpsConfig = gamesConfig.rockPaperScissors as unknown as { rewards: { money: number } };
        const reward = rpsConfig.rewards.money;
        const p1Msg = `§e${match.p1Name}§r chose §b${match.p1Choice}§r`;
        const p2Msg = `§e${match.p2Name}§r chose §b${match.p2Choice}§r`;

        const resultMsg = `\n${p1Msg}\n${p2Msg}\n\n`;

        if (winner === 'draw') {
            if (p1) p1.sendMessage(`§eIt's a Draw!${resultMsg}`);
            if (p2) p2.sendMessage(`§eIt's a Draw!${resultMsg}`);
        } else if (winner === 'p1') {
            if (p1) {
                p1.sendMessage(`§aYou Won!${resultMsg}`);
                incrementPlayerBalance(p1.id, reward);
                p1.sendMessage(`§a+${reward}`);
            }
            if (p2) p2.sendMessage(`§cYou Lost!${resultMsg}`);
        } else {
            if (p1) p1.sendMessage(`§cYou Lost!${resultMsg}`);
            if (p2) {
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
