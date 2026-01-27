import { uiWait } from '@core/utils.js';
import { inviteFriendToGame } from '@features/social/friendManager.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { ActionFormData, ActionFormResponse } from '@minecraft/server-ui';
import { IGame } from '../types.js';

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
            board: Array.from({ length: 9 }).fill(null) as (string | null)[],
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
        if (!isDefined(match)) return;

        const isP1 = player.id === match.p1Id;
        const mySymbol = isP1 ? 'X' : 'O';
        const isMyTurn = match.turn === mySymbol;

        // Render the board as text
        const boardVisual = this.renderBoard(match.board);

        const form = new ActionFormData()
            .title('Tic Tac Toe')
            .body(
                (isNonEmptyString(match.winner)
                    ? `Game Over! ${match.winner === 'Draw' ? "It's a Draw!" : match.winner === mySymbol ? '§2You Won!' : '§4You Lost!'}`
                    : `Turn: ${match.turn} (${isMyTurn ? '§l§2YOU§r' : 'Opponent'})`) +
                    `\n\n${boardVisual}\n\nSelect a cell to move:`
            );

        // Buttons 1-9
        for (let i = 0; i < 9; i++) {
            const cell = match.board[i];
            const label = isDefined(cell) ? (cell === 'X' ? '§cX' : '§aO') : `§7${i + 1}`;
            form.button(label);
        }

        form.button('Refresh / Exit');

        if (match.p2Id === 'AI' && !isDefined(match.winner)) {
            form.button('Invite Friend');
        }

        const res = await uiWait(player, form);
        if (!isDefined(res) || res.canceled) return;
        const response = res as ActionFormResponse;

        if (isNonEmptyString(match.winner)) {
            this.cleanupMatch(match);
            return;
        }

        const selection = response.selection;

        if (isDefined(selection) && selection >= 0 && selection < 9) {
            if (!isMyTurn && match.p2Id !== 'AI') {
                player.sendMessage("§cIt's not your turn!");
                void this.openUI(player);
                return;
            }

            if (isDefined(match.board[selection])) {
                void this.openUI(player);
                return;
            }

            // Move
            match.board[selection] = match.turn;
            this.checkWin(match);

            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            if (match.winner === null) {
                match.turn = match.turn === 'X' ? 'O' : 'X';
                if (match.p2Id === 'AI' && match.turn === 'O') {
                    this.makeAIMove(match);
                }
            }

            void this.openUI(player);
        } else if (selection === 9) {
            // Refresh/Exit
            void this.openUI(player);
        } else if (match.p2Id === 'AI' && selection === 10) {
            // Invite Friend
            this.cleanupMatch(match); // End bot match to invite friend
            await inviteFriendToGame(player, 'ticTacToe');
        }
    }

    private renderBoard(board: (string | null)[]): string {
        const sym = (i: number) => {
            const val = board[i];
            if (val === 'X') return '§c❌§r';
            if (val === 'O') return '§a⭕§r';
            return '§8⬜§r';
        };

        // Centered ASCII-ish grid
        return `   ${sym(0)} ${sym(1)} ${sym(2)}\n   ${sym(3)} ${sym(4)} ${sym(5)}\n   ${sym(6)} ${sym(7)} ${sym(8)}`;
    }

    private checkWin(match: Match) {
        const wins: [number, number, number][] = [
            [0, 1, 2],
            [3, 4, 5],
            [6, 7, 8], // Rows
            [0, 3, 6],
            [1, 4, 7],
            [2, 5, 8], // Cols
            [0, 4, 8],
            [2, 4, 6] // Diagonals
        ];

        for (const [a, b, c] of wins) {
            const cellA = match.board[a];
            if (isDefined(cellA) && cellA === match.board[b] && cellA === match.board[c]) {
                match.winner = cellA;
                return;
            }
        }

        if (!match.board.includes(null)) {
            match.winner = 'Draw';
        }
    }

    private makeAIMove(match: Match) {
        const board = match.board;
        const available: number[] = [];
        for (const [i, element] of board.entries()) {
            if (!isDefined(element)) {
                available.push(i);
            }
        }

        if (available.length > 0) {
            const randomIndex = Math.floor(Math.random() * available.length);
            const move = available[randomIndex];
            if (isDefined(move)) {
                board[move] = 'O';
                this.checkWin(match);
                if (match.winner === null) {
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
