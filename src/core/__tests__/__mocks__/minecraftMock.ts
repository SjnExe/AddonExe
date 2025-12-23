import { jest } from '@jest/globals';

// --- @minecraft/server Mocks ---

export class Dimension {
    id: string;
    constructor(id: string) {
        this.id = id;
    }
    runCommand = jest.fn();
    spawnEntity = jest.fn();
    getEntities = jest.fn(() => []);
    getTopmostBlock = jest.fn();
    getBlock = jest.fn();
    playSound = jest.fn();
}

export const world = {
    getDynamicProperty: jest.fn(),
    setDynamicProperty: jest.fn(),
    getDimension: jest.fn((dim: string) => new Dimension(dim)),
    getAllPlayers: jest.fn(() => []),
    afterEvents: {
        playerSpawn: { subscribe: jest.fn() },
        playerLeave: { subscribe: jest.fn() },
        entityDie: { subscribe: jest.fn() },
        chatSend: { subscribe: jest.fn() }
    },
    beforeEvents: {
        chatSend: { subscribe: jest.fn() },
        playerInteractWithEntity: { subscribe: jest.fn() },
        playerInteractWithBlock: { subscribe: jest.fn() }
    },
    sendMessage: jest.fn()
};

export const system = {
    run: jest.fn((callback: () => void) => {
        callback();
        return 0;
    }),
    runInterval: jest.fn(() => 1),
    runTimeout: jest.fn((cb: () => void) => {
        cb();
        return 1;
    }), // Run immediately for tests
    runJob: jest.fn((generator: Generator) => {
        // Execute generator fully for tests
        let result = generator.next();
        while (!result.done) {
            result = generator.next();
        }
        return 0;
    }),
    clearRun: jest.fn(),
    currentTick: 0,
    beforeEvents: {
        startup: { subscribe: jest.fn() },
        shutdown: { subscribe: jest.fn() },
        watchdogTerminate: { subscribe: jest.fn() }
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

    sendMessage = jest.fn();
    runCommand = jest.fn();
    playSound = jest.fn();
    getDynamicProperty = jest.fn();
    setDynamicProperty = jest.fn();
    isValid() {
        return true;
    }
    triggerEvent = jest.fn();
    getComponent = jest.fn();
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

// --- @minecraft/server-ui Mocks ---

export enum FormCancelationReason {
    UserBusy = 'UserBusy',
    UserClosed = 'UserClosed'
}

export class ModalFormData {
    private _controls: any[] = [];

    title(_text: string) {
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
    submitButton(_text: string) {
        return this;
    }

    show = jest.fn().mockImplementation(async () => {
        return {
            formValues: this._controls.map((c) => {
                if (c.type === 'toggle') return c.defaultValue ?? false;
                if (c.type === 'textField') return c.defaultValue ?? '';
                if (c.type === 'dropdown') return c.defaultValueIndex ?? 0;
                if (c.type === 'slider') return c.defaultValue ?? c.min;
                return null;
            }),
            canceled: false
        };
    });
}

export class ActionFormData {
    private _buttons: any[] = [];

    title(_text: string) {
        return this;
    }
    body(_text: string) {
        return this;
    }
    button(text: string, iconPath?: string) {
        this._buttons.push({ text, iconPath });
        return this;
    }

    show = jest.fn().mockImplementation(async () => {
        return { selection: 0, canceled: false };
    });
}

export class MessageFormData {
    title = jest.fn().mockReturnThis();
    body = jest.fn().mockReturnThis();
    button1 = jest.fn().mockReturnThis();
    button2 = jest.fn().mockReturnThis();
    show = jest.fn().mockImplementation(async () => {
        return { selection: 0, canceled: false };
    });
}

// --- @minecraft/diagnostics Mocks ---

export const sentry = {
    addBreadcrumb: jest.fn(),
    addTag: jest.fn(),
    init: jest.fn(),
    captureException: jest.fn()
};

export enum SentryEventLevel {
    info = 'info',
    warning = 'warning',
    error = 'error',
    fatal = 'fatal',
    debug = 'debug'
}
