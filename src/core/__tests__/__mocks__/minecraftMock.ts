import { jest } from '@jest/globals';

export const world = {
    getDynamicProperty: jest.fn(),
    setDynamicProperty: jest.fn(),
    getAllPlayers: jest.fn(() => []),
    afterEvents: {
        playerSpawn: { subscribe: jest.fn() },
        playerLeave: { subscribe: jest.fn() }
    }
};

export const system = {
    runInterval: jest.fn(),
    runTimeout: jest.fn(),
    clearRun: jest.fn(),
    currentTick: 0
};

export class Player {
    id: string;
    name: string;
    constructor(id: string, name: string) {
        this.id = id;
        this.name = name;
    }
}
