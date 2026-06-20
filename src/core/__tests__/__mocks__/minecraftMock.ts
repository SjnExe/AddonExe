/* eslint-disable @typescript-eslint/no-unused-vars */
import { vi } from 'vitest';

// --- @minecraft/server Mocks ---

export class Dimension {
    id: string;
    constructor(id: string) {
        this.id = id;
    }
    runCommand = vi.fn();
    spawnEntity = vi.fn();
    getEntities = vi.fn(() => []);
    getTopmostBlock = vi.fn();
    getBlock = vi.fn();
    playSound = vi.fn();
}

export class BlockVolume {
    constructor(
        public from: { x: number; y: number; z: number },
        public to: { x: number; y: number; z: number }
    ) {}
}

export const world = {
    getDynamicProperty: vi.fn(),
    setDynamicProperty: vi.fn(),
    getDimension: vi.fn((dim: string) => new Dimension(dim)),
    getAllPlayers: vi.fn(() => []),
    afterEvents: {
        playerSpawn: { subscribe: vi.fn() },
        playerLeave: { subscribe: vi.fn() },
        entityDie: { subscribe: vi.fn() },
        chatSend: { subscribe: vi.fn() }
    },
    beforeEvents: {
        chatSend: { subscribe: vi.fn() },
        playerInteractWithEntity: { subscribe: vi.fn() },
        playerInteractWithBlock: { subscribe: vi.fn() },
        itemUse: { subscribe: vi.fn() },
        playerBreakBlock: { subscribe: vi.fn() },
        playerPlaceBlock: { subscribe: vi.fn() }
    },
    sendMessage: vi.fn()
};

export const system = {
    run: vi.fn((callback: () => void) => {
        callback();
        return 0;
    }),
    runInterval: vi.fn(() => 1),
    runTimeout: vi.fn((cb: () => void) => {
        cb();
        return 1;
    }), // Run immediately for tests
    runJob: vi.fn((generator: Generator) => {
        // Execute generator fully for tests
        let result = generator.next();
        while (!result.done) {
            result = generator.next();
        }
        return 0;
    }),
    clearRun: vi.fn(),
    currentTick: 0,
    beforeEvents: {
        startup: { subscribe: vi.fn() },
        shutdown: { subscribe: vi.fn() },
        watchdogTerminate: { subscribe: vi.fn() }
    }
};

export class Player {
    id: string;
    name: string;
    tags: Set<string>;
    location: { x: number; y: number; z: number; dimension: Dimension };

    constructor(id: string, name: string) {
        this.id = id;
        this.name = name;
        this.tags = new Set();
        this.location = { x: 0, y: 0, z: 0, dimension: new Dimension('overworld') };
    }

    hasTag(tag: string) {
        return this.tags.has(tag);
    }

    addTag(tag: string) {
        this.tags.add(tag);
        return true;
    }

    removeTag(tag: string) {
        return this.tags.delete(tag);
    }

    sendMessage = vi.fn();
    runCommand = vi.fn();
    playSound = vi.fn();
    getDynamicProperty = vi.fn();
    setDynamicProperty = vi.fn();
    isValid = true;
    triggerEvent = vi.fn();
    getComponent = vi.fn();
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

export enum GameMode {
    Survival = 'survival',
    Creative = 'creative',
    Adventure = 'adventure',
    Spectator = 'spectator'
}

// --- @minecraft/server-ui Mocks ---

export enum FormCancelationReason {
    UserBusy = 'UserBusy',
    UserClosed = 'UserClosed'
}

interface Control {
    type: string;
    label: string;
    placeholder?: string;
    defaultValue?: string | boolean | number | undefined;
    options?: string[];
    defaultValueIndex?: number | undefined;
    min?: number | undefined;
    max?: number | undefined;
    step?: number | undefined;
}

export class ModalFormData {
    private _controls: Control[] = [];

    title(_: string) {
        return this;
    }
    textField(label: string, placeholder: string, defaultValue?: string) {
        this._controls.push({ type: 'textField', label, placeholder, defaultValue });
        return this;
    }
    dropdown(label: string, options: string[], defaultValueIndex?: number) {
        this._controls.push({ type: 'dropdown', label, options, defaultValueIndex });
        return this;
    }
    toggle(label: string, defaultValue?: boolean) {
        this._controls.push({ type: 'toggle', label, defaultValue });
        return this;
    }
    slider(label: string, min: number, max: number, step: number, defaultValue?: number) {
        this._controls.push({ type: 'slider', label, min, max, step, defaultValue });
        return this;
    }
    submitButton(_: string) {
        return this;
    }

    show = vi.fn().mockImplementation(async () => {
        return {
            formValues: this._controls.map((c): string | number | boolean | undefined => {
                if (c.type === 'toggle') return c.defaultValue ?? false;
                if (c.type === 'textField') return c.defaultValue ?? '';
                if (c.type === 'dropdown') return c.defaultValueIndex ?? 0;
                if (c.type === 'slider') return c.defaultValue ?? c.min;
                return undefined;
            }),
            canceled: false
        };
    });
}

export class ActionFormData {
    private _buttons: { text: string; iconPath?: string | undefined }[] = [];

    title(_: string) {
        return this;
    }
    body(_: string) {
        return this;
    }
    button(text: string, iconPath?: string) {
        this._buttons.push({ text, iconPath });
        return this;
    }

    show = vi.fn().mockImplementation(async () => {
        return { selection: 0, canceled: false };
    });
}

export class MessageFormData {
    title = vi.fn().mockReturnThis();
    body = vi.fn().mockReturnThis();
    button1 = vi.fn().mockReturnThis();
    button2 = vi.fn().mockReturnThis();
    show = vi.fn().mockImplementation(async () => {
        return { selection: 0, canceled: false };
    });
}
