import { IPanelHandler } from '@ui/types.js';

class PanelRouter {
    private readonly handlers: IPanelHandler[] = [];

    register(handler: IPanelHandler) {
        this.handlers.push(handler);
    }

    getHandler(panelId: string): IPanelHandler | undefined {
        return this.handlers.find((h) => h.canHandle(panelId));
    }
}

export const panelRouter = new PanelRouter();
