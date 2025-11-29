export const system = { currentTick: 0, runInterval: () => {}, clearRun: () => {} };
export const world = {
    afterEvents: { entityHurt: { subscribe: () => {}, unsubscribe: () => {} } },
    sendMessage: () => {}
};
export class Player {}
export class ActionFormData {}
export class ModalFormData {}
export class MessageFormData {}
export const FormCancelationReason = { UserBusy: 'UserBusy', UserClosed: 'UserClosed' };
