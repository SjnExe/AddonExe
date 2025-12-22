import * as mc from '@minecraft/server';

export interface GamePlayer {
    id: string;
    name: string;
    score: number;
}

export interface IGame {
    id: string;
    name: string;
    description: string;
    minPlayers: number;
    maxPlayers: number; // 0 for unlimited

    // Lifecycle
    start(players: mc.Player[], config?: unknown): void;
    stop(): void;

    // Events
    onPlayerJoin?(player: mc.Player): void;
    onPlayerLeave?(player: mc.Player): void;
    onChat?(player: mc.Player, message: string): boolean; // Return true if handled (cancel chat)
}

export interface GameDefinition {
    id: string;
    name: string;
    description: string;
    icon: string; // Texture path
    factory: () => IGame;
}
