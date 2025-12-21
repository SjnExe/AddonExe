import * as mc from '@minecraft/server';
import { ActionFormData, ActionFormResponse } from '@minecraft/server-ui';
import { IGame } from '../types.js';
import { uiWait } from '@core/utils.js';

interface Match {
    p1Id: string;
    p1Name: string;
    p2Id: string;
    p2Name: string;
    board: (string | null)[];
    turn: 'X' | 'O';
    winner: string | null;
}

export class TicTacToeGame implements IGame {
    id = 'ticTacToe';
    name = 'Tic Tac Toe';
    description = 'Classic 3x3 strategy game.';
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
            board: Array.from({length: 9}).fill(null) as (string | null)[],
            turn: 'X',
            winner: null
        };

        this.matches.set(p1.id, match);
        if (!isAI) this.matches.set(p2Id, match);

        void this.openUI(p1);
    }

    stop() {
        this.matches.clear();
    }

    async openUI(player: mc.Player) {
        const match = this.matches.get(player.id);
        if (!match) return;

        const isP1 = player.id === match.p1Id;
        const mySymbol = isP1 ? 'X' : 'O';
        const isMyTurn = match.turn === mySymbol;

        const form = new ActionFormData()
            .title(`Vs ${isP1 ? match.p2Name : match.p1Name}`)
            .body(match.winner
                ? `Game Over! ${match.winner === 'Draw' ? 'It\'s a Draw!' : (match.winner === mySymbol ? '§2You Won!' : '§4You Lost!')}`
                : `Turn: ${match.turn} (${isMyTurn ? '§l§2YOU§r' : 'Opponent'})`
            );

        for (let i = 0; i < 9; i++) {
            const cell = match.board[i];
            const label = cell ? (cell === 'X' ? '§c❌' : '§a⭕') : ' ';
            form.button(label);
        }

        form.button('Refresh / Exit');

        const res = await uiWait(player, form);
        if (!res || res.canceled) return;
        const response = res as ActionFormResponse;

        if (match.winner) {
            this.cleanupMatch(match);
            return;
        }

        const selection = response.selection;

        if (selection !== undefined && selection >= 0 && selection < 9) {
            if (!isMyTurn && match.p2Id !== 'AI') {
                player.sendMessage("§cIt's not your turn!");
                void this.openUI(player);
                return;
            }

            if (match.board[selection]) {
                void this.openUI(player);
                return;
            }

            // Move
            match.board[selection] = match.turn;
            this.checkWin(match);

            if (!match.winner) {
                match.turn = match.turn === 'X' ? 'O' : 'X';
                if (match.p2Id === 'AI' && match.turn === 'O') {
                    this.makeAIMove(match);
                }
            }

            void this.openUI(player);
        } else {
            // Refresh
            void this.openUI(player);
        }
    }

    private checkWin(match: Match) {
        const wins = [
            [0,1,2], [3,4,5], [6,7,8], // Rows
            [0,3,6], [1,4,7], [2,5,8], // Cols
            [0,4,8], [2,4,6]           // Diagonals
        ];

        for (const [a, b, c] of wins) {
            if (match.board[a] && match.board[a] === match.board[b] && match.board[a] === match.board[c]) {
                match.winner = match.board[a];
                return;
            }
        }

        if (!match.board.includes(null)) {
            match.winner = 'Draw';
        }
    }

    private makeAIMove(match: Match) {
        const available: number[] = [];
        for (let i = 0; i < match.board.length; i++) {
            if (match.board[i] === null) {
                available.push(i);
            }
        }

        if (available.length > 0) {
            const randomIndex = Math.floor(Math.random() * available.length);
            const move = available[randomIndex];
            if (typeof move === 'number') {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                match.board[move] = 'O';
                this.checkWin(match);
                if (!match.winner) {
                    match.turn = 'X';
                }
            }
        }
    }

    private cleanupMatch(match: Match) {
        this.matches.delete(match.p1Id);
        if (match.p2Id !== 'AI') this.matches.delete(match.p2Id);
    }
}

export const ticTacToe = new TicTacToeGame();
