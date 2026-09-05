import { mock } from 'bun:test';

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
    getDynamicProperty: mock((key) => _testDynamicProperties.get(key)),
    setDynamicProperty: mock((key, val) => {
        if (val === undefined) {
            _testDynamicProperties.delete(key);
        } else {
            _testDynamicProperties.set(key, val);
        }
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

export enum DataDrivenScreenClosedReason {
    ClientClosed = 'ClientClosed',
    ServerClosed = 'ServerClosed',
    UserBusy = 'UserBusy'
}

export class ObservableBoolean {
    private _data: boolean;
    private _listeners: Set<(val: boolean) => void> = new Set();

    constructor(
        initialValue: boolean,
        public options?: { clientWritable?: boolean }
    ) {
        this._data = initialValue;
    }

    getData(): boolean {
        return this._data;
    }

    setData(value: boolean): void {
        this._data = value;
        for (const cb of this._listeners) {
            cb(value);
        }
    }

    subscribe(callback: (val: boolean) => void) {
        this._listeners.add(callback);
        return callback;
    }

    unsubscribe(callback: (val: boolean) => void): boolean {
        return this._listeners.delete(callback);
    }
}

export class ObservableNumber {
    private _data: number;
    private _listeners: Set<(val: number) => void> = new Set();

    constructor(
        initialValue: number,
        public options?: { clientWritable?: boolean }
    ) {
        this._data = initialValue;
    }

    getData(): number {
        return this._data;
    }

    setData(value: number): void {
        this._data = value;
        for (const cb of this._listeners) {
            cb(value);
        }
    }

    subscribe(callback: (val: number) => void) {
        this._listeners.add(callback);
        return callback;
    }

    unsubscribe(callback: (val: number) => void): boolean {
        return this._listeners.delete(callback);
    }
}

export class ObservableString {
    private _data: string;
    private _listeners: Set<(val: string) => void> = new Set();

    constructor(
        initialValue: string,
        public options?: { clientWritable?: boolean }
    ) {
        this._data = initialValue;
    }

    getData(): string {
        return this._data;
    }

    setData(value: string): void {
        this._data = value;
        for (const cb of this._listeners) {
            cb(value);
        }
    }

    subscribe(callback: (val: string) => void) {
        this._listeners.add(callback);
        return callback;
    }

    unsubscribe(callback: (val: string) => void): boolean {
        return this._listeners.delete(callback);
    }

    async getFilteredText(_player: Player): Promise<string> {
        return this._data;
    }
}

export class ObservableUIRawMessage {
    private _data: unknown;
    private _listeners: Set<(val: unknown) => void> = new Set();

    constructor(
        initialValue: unknown,
        public options?: { clientWritable?: boolean }
    ) {
        this._data = initialValue;
    }

    getData(): unknown {
        return this._data;
    }

    setData(value: unknown): void {
        this._data = value;
        for (const cb of this._listeners) {
            cb(value);
        }
    }

    subscribe(callback: (val: unknown) => void) {
        this._listeners.add(callback);
        return callback;
    }

    unsubscribe(callback: (val: unknown) => void): boolean {
        return this._listeners.delete(callback);
    }
}

export class CustomForm {
    player: Player;
    title: ObservableString | string;
    private _showing = false;
    private _buttons: { label: unknown; onClick: () => void }[] = [];

    constructor(player: Player, title: ObservableString | string) {
        this.player = player;
        this.title = title;
    }

    button(label: ObservableString | string, onClick: () => void): this {
        this._buttons.push({ label, onClick });
        return this;
    }

    closeButton(): this {
        return this;
    }

    divider(): this {
        return this;
    }

    dropdown(_label: ObservableString | string, _value: ObservableNumber, _items: unknown[]): this {
        return this;
    }

    header(_text: ObservableString | string): this {
        return this;
    }

    label(_text: ObservableString | string): this {
        return this;
    }

    slider(_label: ObservableString | string, _value: ObservableNumber, _min: number | ObservableNumber, _max: number | ObservableNumber): this {
        return this;
    }

    spacer(): this {
        return this;
    }

    textField(_label: ObservableString | string, _text: ObservableString): this {
        return this;
    }

    toggle(_label: ObservableString | string, _toggled: ObservableBoolean): this {
        return this;
    }

    close(): void {
        this._showing = false;
    }

    isShowing(): boolean {
        return this._showing;
    }

    show = mock().mockImplementation(async (): Promise<DataDrivenScreenClosedReason> => {
        this._showing = true;
        for (const btn of this._buttons) {
            btn.onClick();
        }
        return DataDrivenScreenClosedReason.ClientClosed;
    });
}

export const uiManager = {
    closeAllForms: mock()
};

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
                if (c.type === 'toggle') {
                    return c.defaultValue ?? false;
                }
                if (c.type === 'textField') {
                    return c.defaultValue ?? '';
                }
                if (c.type === 'dropdown') {
                    return c.defaultValueIndex ?? 0;
                }
                if (c.type === 'slider') {
                    return c.defaultValue ?? c.min;
                }
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

// --- Component Types added for strict production-grade enum matching ---

// --- Component Types for strict enum matching ---
export const EntityComponentTypes = {
    Inventory: 'minecraft:inventory',
    Equippable: 'minecraft:equippable',
    EnderInventory: 'minecraft:ender_inventory',
    Rideable: 'minecraft:rideable',
    Tameable: 'minecraft:tameable',
    IsTamed: 'minecraft:is_tamed',
    TypeFamily: 'minecraft:type_family',
    Projectile: 'minecraft:projectile'
} as const;

export const ItemComponentTypes = {
    Durability: 'minecraft:durability',
    Enchantable: 'minecraft:enchantable'
} as const;
