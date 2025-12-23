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
    run: jest.fn((callback: () => void) => {
        callback();
        return 0;
    }),
    runInterval: jest.fn(),
    runTimeout: jest.fn(),
    clearRun: jest.fn(),
    currentTick: 0,
    beforeEvents: {
        startup: { subscribe: jest.fn() }
    }
};

export class Player {
    id: string;
    name: string;
    constructor(id: string, name: string) {
        this.id = id;
        this.name = name;
    }
}

export enum CustomCommandParamType {
    Integer = 'int',
    Float = 'float',
    Boolean = 'boolean',
    String = 'string',
    BlockType = 'block',
    ItemType = 'item',
    PlayerSelector = 'player'
}
