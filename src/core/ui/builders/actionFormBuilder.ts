import { uiWait } from '@core/utils/ui.js';
import { Player } from '@minecraft/server';
import { ActionFormData, ActionFormResponse } from '@minecraft/server-ui';

export type GridColumns = 1 | 2 | 3 | 4 | 'board' | '2048' | 'c4' | 'minesweeper' | 'ms9' | 'ms12' | 'ms16';

export class ActionFormBuilder {
  private readonly form: ActionFormData;
  private readonly callbacks: Map<number, (() => void | Promise<void>) | undefined>;
  private gridColumns: GridColumns = 2;
  private rawTitle = '';

  constructor() {
    this.form = new ActionFormData();
    this.callbacks = new Map();
  }

  public title(titleText: string): this {
    this.rawTitle = titleText;
    this.applyTitleWithGrid();
    return this;
  }

  public grid(columns: GridColumns): this {
    this.gridColumns = columns;
    if (this.rawTitle) {
      this.applyTitleWithGrid();
    }
    return this;
  }

  private applyTitleWithGrid(): void {
    if (this.gridColumns === 1) {
      this.form.title(`\uE100§r${this.rawTitle}`);
      return;
    }
    if (this.gridColumns === 'board') {
      this.form.title(`§9§0§0§f§r${this.rawTitle}`);
      return;
    }
    if (this.gridColumns === '2048') {
      this.form.title(`§7§0§4§f§r${this.rawTitle}`);
      return;
    }
    if (this.gridColumns === 'c4') {
      this.form.title(`§7§0§7§f§r${this.rawTitle}`);
      return;
    }
    if (this.gridColumns === 'ms9') {
      this.form.title(`§8§0§9§f§r${this.rawTitle}`);
      return;
    }
    if (this.gridColumns === 'ms12' || this.gridColumns === 'minesweeper') {
      this.form.title(`§8§1§2§f§r${this.rawTitle}`);
      return;
    }
    if (this.gridColumns === 'ms16') {
      this.form.title(`§8§1§6§f§r${this.rawTitle}`);
      return;
    }
    const buttonCount = Math.max(1, this.callbacks.size);
    const maxRows = 24;
    const rows = Math.max(1, Math.min(maxRows, Math.ceil(buttonCount / this.gridColumns)));
    const tens = Math.floor(rows / 10);
    const ones = rows % 10;
    this.form.title(`§${this.gridColumns}§${tens}§${ones}§f§r${this.rawTitle}`);
  }

  public getColumns(): GridColumns {
    return this.gridColumns;
  }

  public body(bodyText: string): this {
    this.form.body(bodyText);
    return this;
  }

  public header(headerText: string): this {
    if (typeof (this.form as unknown as { header?: (t: string) => void }).header === 'function') {
      (this.form as unknown as { header: (t: string) => void }).header(headerText);
    }
    return this;
  }

  public label(labelText: string): this {
    if (typeof (this.form as unknown as { label?: (t: string) => void }).label === 'function') {
      (this.form as unknown as { label: (t: string) => void }).label(labelText);
    }
    return this;
  }

  public divider(): this {
    if (typeof (this.form as unknown as { divider?: () => void }).divider === 'function') {
      (this.form as unknown as { divider: () => void }).divider();
    }
    return this;
  }

  public button(text: string, iconPath?: string | null, onClick?: () => void | Promise<void>): this {
    if (iconPath) {
      this.form.button(text, iconPath);
    } else {
      this.form.button(text);
    }

    if (onClick) {
      this.callbacks.set(this.callbacks.size, onClick);
    } else {
      this.callbacks.set(this.callbacks.size, undefined);
    }
    return this;
  }

  public addBackButton(onClick: () => void | Promise<void>): this {
    this.button('§cBack', 'textures/ui/arrow_left', onClick);
    return this;
  }

  public async show(player: Player, _options?: { wait?: boolean }): Promise<ActionFormResponse> {
    if (this.rawTitle) {
      this.applyTitleWithGrid();
    }
    const response = (await uiWait(player, this.form)) as ActionFormResponse;

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
    itemsPerPage = 45,
  ): this {
    const totalPages = Math.ceil(items.length / itemsPerPage);
    const currentPage = Math.max(1, Math.min(page, totalPages));

    const startIndex = (currentPage - 1) * itemsPerPage;
    const itemsToShow = items.slice(startIndex, startIndex + itemsPerPage);

    if (totalPages > 1 && currentPage > 1) {
      this.button('§6< Previous Page', 'textures/ui/up_arrow', () => onPageChange(currentPage - 1));
    }

    for (const item of itemsToShow) {
      renderButton(item, this);
    }

    if (totalPages > 1 && currentPage < totalPages) {
      this.button('§6Next Page >', 'textures/ui/down_arrow', () => onPageChange(currentPage + 1));
    }
    return this;
  }
}
