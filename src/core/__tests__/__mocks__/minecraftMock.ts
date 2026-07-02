import { mock } from 'bun:test';
/* eslint-disable @typescript-eslint/no-unused-vars */

// --- @minecraft/server Mocks ---

export class Dimension {
    id: string;
    constructor(id: string) {
        this.id = id;
    }
    runCommand = mock();
    spawnEntity = mock();
    getEntities = mock(() => []);
    getTopmostBlock = mock();
    getBlock = mock();
    playSound = mock();
}

export class BlockVolume {
    constructor(
        public from: { x: number; y: number; z: number },
        public to: { x: number; y: number; z: number }
    ) {}
}

// Stateful Dynamic Property Store
const _testDynamicProperties = new Map();
export const world = {
    getDynamicProperty: mock((key: string) => _testDynamicProperties.get(key)),
    setDynamicProperty: mock((key: string, val: any) => {
        if (val === undefined) _testDynamicProperties.delete(key);
        else _testDynamicProperties.set(key, val);
    }),
    getDimension: mock((dim: string) => new Dimension(dim)),
    getAllPlayers: mock(() => []),
    afterEvents: {
        playerSpawn: { subscribe: mock() },
        playerLeave: { subscribe: mock() },
        entityDie: { subscribe: mock() },
        chatSend: { subscribe: mock() }
    },
    beforeEvents: {
        chatSend: { subscribe: mock() },
        playerInteractWithEntity: { subscribe: mock() },
        playerInteractWithBlock: { subscribe: mock() },
        itemUse: { subscribe: mock() },
        playerBreakBlock: { subscribe: mock() },
        playerPlaceBlock: { subscribe: mock() }
    },
    sendMessage: mock()
};

export const system = {
    run: mock((callback: () => void) => {
        callback();
        return 0;
    }),
    runInterval: mock(() => 1),
    runTimeout: mock((cb: () => void) => {
        cb();
        return 1;
    }), // Run immediately for tests
    runJob: mock((generator: Generator) => {
        // Execute generator fully for tests
        let result = generator.next();
        while (!result.done) {
            result = generator.next();
        }
        return 0;
    }),
    clearRun: mock(),
    currentTick: 0,
    beforeEvents: {
        startup: { subscribe: mock() },
        shutdown: { subscribe: mock() },
        watchdogTerminate: { subscribe: mock() }
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

    sendMessage = mock();
    runCommand = mock();
    playSound = mock();
    getDynamicProperty = mock();
    setDynamicProperty = mock();
    isValid = true;
    triggerEvent = mock();
    getComponent = mock();
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

    show = mock().mockImplementation(async () => {
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

    show = mock().mockImplementation(async () => {
        return { selection: 0, canceled: false };
    });
}

export class MessageFormData {
    title = mock().mockReturnThis();
    body = mock().mockReturnThis();
    button1 = mock().mockReturnThis();
    button2 = mock().mockReturnThis();
    show = mock().mockImplementation(async () => {
        return { selection: 0, canceled: false };
    });
}

// --- added for itemsManager tests ---
export class ItemStack {
    typeId: string;
    amount: number;
    maxAmount: number;

    constructor(typeId: string, amount: number) {
        if (typeId === 'invalid:item') {
            throw new Error('Invalid item type');
        }
        this.typeId = typeId;
        this.amount = amount;
        this.maxAmount = 64; // Default max stack size
    }
}
