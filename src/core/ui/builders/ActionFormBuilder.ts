import { Player } from '@minecraft/server';
import { ActionFormData, ActionFormResponse } from '@minecraft/server-ui';

export class ActionFormBuilder {
    private readonly form: ActionFormData;
    private readonly callbacks: Map<number, () => void | Promise<void>>;

    constructor() {
        this.form = new ActionFormData();
        this.callbacks = new Map();
    }

    public title(titleText: string): this {
        this.form.title(titleText);
        return this;
    }

    public body(bodyText: string): this {
        this.form.body(bodyText);
        return this;
    }

    public button(text: string, iconPath?: string | null, onClick?: () => void | Promise<void>): this {
        if (iconPath) {
            this.form.button(text, iconPath);
        } else {
            this.form.button(text);
        }

        if (onClick) {
            // form items are 0-indexed in order of addition
            const index = this.callbacks.size;
            this.callbacks.set(index, onClick);
        } else {
            // Keep indices aligned even if no callback
            this.callbacks.set(this.callbacks.size, () => {});
        }
        return this;
    }

    public addBackButton(onClick: () => void | Promise<void>): this {
        this.button('§cBack', 'textures/gui/controls/left', onClick);
        return this;
    }

    public async show(player: Player): Promise<ActionFormResponse> {
        const response = await this.form.show(player);

        if (response.canceled) {
            return response;
        }

        const selection = response.selection;
        if (selection !== undefined) {
            const callback = this.callbacks.get(selection);
            if (callback) {
                await callback();
            }
        }

        return response;
    }

    public addPaginatedButtons<T>(
        items: T[],
        page: number,
        renderButton: (item: T, formBuilder: ActionFormBuilder) => void,
        onPageChange: (newPage: number) => Promise<void> | void,
        itemsPerPage = 10
    ): this {
        const totalPages = Math.ceil(items.length / itemsPerPage);
        const currentPage = Math.max(1, Math.min(page, totalPages));

        const startIndex = (currentPage - 1) * itemsPerPage;
        const itemsToShow = items.slice(startIndex, startIndex + itemsPerPage);

        for (const item of itemsToShow) {
            renderButton(item, this);
        }

        if (totalPages > 1) {
            if (currentPage > 1) {
                this.button('§6< Previous Page', 'textures/ui/arrow_left', () => onPageChange(currentPage - 1));
            }

            if (currentPage < totalPages) {
                this.button('§6Next Page >', 'textures/ui/arrow_right', () => onPageChange(currentPage + 1));
            }
        }
        return this;
    }
}
