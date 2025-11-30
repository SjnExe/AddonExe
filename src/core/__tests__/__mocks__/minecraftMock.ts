export const system = {
    currentTick: 0,
    runInterval: (cb: () => void) => { cb(); return 1; },
    runTimeout: (cb: () => void) => { cb(); return 1; },
    run: (cb: () => void) => { cb(); return 1; },
    clearRun: () => {}
};

const dynamicProperties = new Map<string, unknown>();

export const world = {
    afterEvents: {
        entityHurt: { subscribe: () => {}, unsubscribe: () => {} },
        playerSpawn: { subscribe: () => {}, unsubscribe: () => {} },
        playerLeave: { subscribe: () => {}, unsubscribe: () => {} }
    },
    sendMessage: () => {},
    getAllPlayers: () => [],
    getDynamicProperty: (key: string) => dynamicProperties.get(key),
    setDynamicProperty: (key: string, value: unknown) => {
        if (value === undefined || value === null) {
            dynamicProperties.delete(key);
        } else {
            dynamicProperties.set(key, value);
        }
    }
};

export class Player {
    id: string = 'test-player-id';
    name: string = 'TestPlayer';
    sendMessage() {}
}
export class ActionFormData {}
export class ModalFormData {}
export class MessageFormData {}
export const FormCancelationReason = { UserBusy: 'UserBusy', UserClosed: 'UserClosed' };
