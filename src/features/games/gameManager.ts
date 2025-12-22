import { GameDefinition, IGame } from './types.js';

class GameManager {
    private readonly definitions = new Map<string, GameDefinition>();
    private readonly activeGlobalGames = new Map<string, IGame>(); // gameId -> instance

    register(def: GameDefinition) {
        this.definitions.set(def.id, def);
    }

    getDefinition(id: string) {
        return this.definitions.get(id);
    }

    getAllDefinitions() {
        return [...this.definitions.values()];
    }

    getActiveGame(id: string) {
        return this.activeGlobalGames.get(id);
    }

    startGlobalGame(id: string, config: unknown = {}) {
        const def = this.definitions.get(id);
        if (!def) return false;

        const game = def.factory();
        game.start([], config); // Global games might not have specific players at start
        this.activeGlobalGames.set(id, game);
        return true;
    }

    stopGlobalGame(id: string) {
        const game = this.activeGlobalGames.get(id);
        if (game) {
            game.stop();
            this.activeGlobalGames.delete(id);
        }
    }
}

export const gameManager = new GameManager();
