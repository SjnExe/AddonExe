import { getAllPlayersFromCache, getPlayerFromCache } from '@core/playerCache.js';
import { uiWait } from '@core/utils.js';
import { isDefined } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { ActionFormData, ActionFormResponse } from '@minecraft/server-ui';
import { IGame } from '../types.js';

interface Match {
    p1Id: string;
    p1Name: string;
    p2Id: string;
    p2Name: string;
    isAI: boolean;
    state: 'waiting' | 'done';
    p1Move?: 'rock' | 'paper' | 'scissors';
    p2Move?: 'rock' | 'paper' | 'scissors';
    winner?: string | 'Draw';
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
            p2Id,
            p2Name,
            isAI,
            state: 'waiting'
        };

        this.matches.set(p1.id, match);
        if (!isAI) this.matches.set(p2Id, match);

        void this.openUI(p1);
        if (opponent) void this.openUI(opponent);
    }

    stop() {
        this.matches.clear();
    }

    async openUI(player: mc.Player) {
        const match = this.matches.get(player.id);
        if (!isDefined(match)) return;

        const isP1 = player.id === match.p1Id;
        const myMove = isP1 ? match.p1Move : match.p2Move;
        const oppMove = isP1 ? match.p2Move : match.p1Move;

        // If waiting for opponent
        if (match.state === 'waiting') {
            if (isDefined(myMove)) {
                const form = new ActionFormData()
                    .title('Rock Paper Scissors')
                    .body(`§eWaiting for ${isP1 ? match.p2Name : match.p1Name} to choose...`)
                    .button('Refresh');

                const res = await uiWait(player, form);
                if (res && !res.canceled) {
                    void this.openUI(player);
                }
                return;
            }

            const form = new ActionFormData()
                .title('Rock Paper Scissors')
                .body('Choose your move!')
                .button('Rock', 'textures/items/coal')
                .button('Paper', 'textures/items/paper')
                .button('Scissors', 'textures/items/shears');

            const res = await uiWait(player, form);
            if (!isDefined(res) || res.canceled) return;
            const response = res as ActionFormResponse;

            const moves = ['rock', 'paper', 'scissors'] as const;
            if (isDefined(response.selection)) {
                const move = moves[response.selection];
                if (isP1) match.p1Move = move;
                else match.p2Move = move;

                if (match.isAI) {
                    match.p2Move = moves[Math.floor(Math.random() * 3)];
                }

                this.checkMatchState(match);
                void this.openUI(player);
            }
        } else {
            // Game Over
            const winnerText =
                match.winner === 'Draw'
                    ? "It's a Draw!"
                    : match.winner === player.id
                      ? '§aYou Won!'
                      : '§cYou Lost!';

            const oppMoveText = oppMove
                ? oppMove.charAt(0).toUpperCase() + oppMove.slice(1)
                : 'Unknown';

            const form = new ActionFormData()
                .title('Game Over')
                .body(`${winnerText}\n\nYou chose: ${myMove}\nOpponent chose: ${oppMoveText}`)
                .button('Close');

            await uiWait(player, form);
            this.cleanupMatch(match);
        }
    }

    private checkMatchState(match: Match) {
        if (match.p1Move && match.p2Move) {
            match.state = 'done';
            match.winner = this.determineWinner(match);

            // Re-open UI for both players to show result
            // Optimization: Use cache instead of getAllPlayers
            const p1 = getPlayerFromCache(match.p1Id);
            if (p1) void this.openUI(p1);

            if (!match.isAI) {
                const p2 = getPlayerFromCache(match.p2Id);
                if (p2) void this.openUI(p2);
            }
        }
    }

    private determineWinner(match: Match): string | 'Draw' {
        const { p1Move, p2Move } = match;
        if (p1Move === p2Move) return 'Draw';

        if (
            (p1Move === 'rock' && p2Move === 'scissors') ||
            (p1Move === 'paper' && p2Move === 'rock') ||
            (p1Move === 'scissors' && p2Move === 'paper')
        ) {
            return match.p1Id;
        }
        return match.p2Id;
    }

    private cleanupMatch(match: Match) {
        this.matches.delete(match.p1Id);
        if (!match.isAI) this.matches.delete(match.p2Id);
    }
}

export const rockPaperScissors = new RockPaperScissorsGame();
