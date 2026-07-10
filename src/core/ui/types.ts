import * as mc from '@minecraft/server';
import { ActionFormData, ActionFormResponse, ModalFormData, ModalFormResponse } from '@minecraft/server-ui';

// --- TYPE DEFINITIONS ---

export type UIControlType = 'toggle' | 'textField' | 'dropdown';

export interface ConfigSetting {
    /** The dot-separated path to the setting in the config object (e.g., 'tpa.enabled'). */
    key: string;
    /** The user-friendly label for the setting in the UI. */
    label: string;
    /** The type of UI control to use for this setting. */
    type: UIControlType;
    /** For 'dropdown' type, the list of available option strings. */
    options?: string[];
    /** A short description of the setting, shown as a tooltip or help text. */
    description?: string;
}

export interface ConfigCategory {
    /** A unique identifier for the category. */
    id: string;
    /** The title of the category panel. */
    title: string;
    /** The icon texture path for the category button. */
    icon: string;
    /** The source of the configuration (e.g., 'spawn'). Defaults to 'main'. */
    configSource?: string;
    /** The configuration category this system belongs to (e.g., 'Economy', 'Moderation'). */
    category?: string;
    /** An array of settings within this category. */
    settings: ConfigSetting[];
}

export interface PanelItem {
    /** A unique identifier for the button. */
    id: string;
    /** The display text for the button. */
    text: string;
    /** An optional icon texture path. */
    icon?: string;
    /** The permission node required to see this button. Defaults to 'ui.panel.member' if not specified. */
    permission?: string;
    /** The action to perform when clicked. */
    actionType: 'openPanel' | 'functionCall';
    /** The ID of the panel to open or the function to call. */
    actionValue: string;
    /** An optional number to control the order of items. Lower numbers appear first. */
    sortId?: number;
    /** Optional dot-separated config path to check if a feature is enabled. */
    requiresFeature?: string;
}

export interface PanelDefinition {
    /** The title of the panel. */
    title: string;
    /** The ID of the parent panel for back navigation. undefined for top-level panels. */
    parentPanelId: string | undefined;
    /** The buttons to display on this panel. */
    items: PanelItem[];
    /** Optional: Permission node required to view this panel. */
    permission?: string;
    /** Optional: Static body text for the panel. */
    body?: string;
}

export interface UIContext extends Record<string, unknown> {
    page?: number;
    id?: string;
    selectedItemId?: string;
    targetPlayerId?: string;
    customTitle?: string;
    returnPanel?: string;
    uiHistory?: { panelId: string; context: Record<string, unknown> }[];
}

export interface IPanelHandler {
    /** Returns true if this handler manages the given panelId */
    canHandle(panelId: string): boolean;
    /** Returns the items for a HEADLESS panel (buttons list). Returns undefined/empty if not applicable. */
    getItems?(player: mc.Player, panelId: string, context: UIContext): Promise<PanelItem[] | undefined>;
    /** Handles the result (button click or modal submit) */
    handleResponse?(player: mc.Player, panelId: string, response: ActionFormResponse | ModalFormResponse, context: UIContext): Promise<void>;
    /** Optional: Builds a custom Modal form (if not using headless items) */
    buildModal?(player: mc.Player, panelId: string, context: UIContext): Promise<ModalFormData | ActionFormData | undefined | void>;
    /** Optional: Returns the body text for an ActionFormData panel. */
    getBody?(player: mc.Player, panelId: string, context: UIContext): Promise<string | undefined | void>;
    /** Optional: Returns the title for an ActionFormData panel. */
    getTitle?(player: mc.Player, panelId: string, context: UIContext): Promise<string | undefined | void>;
}

export interface ShopListEntry {
    type: 'item' | 'subCategory';
    id: string; // The ID of the item or subcategory
    name: string; // Display name or subcat name
    icon?: string;
    buyPrice?: number;
    sellPrice?: number;
    permission?: string;
    items?: Record<string, ShopItem>;
}

export interface ShopItem {
    buyPrice: number;
    sellPrice: number;
    permission?: string;
    icon?: string;
    displayName?: string;
    itemId?: string; // Minecraft ID
}

export interface MainConfig {
    shop: ShopConfig;
    kits: { enabled: boolean };
    chat: { enabled: boolean; allowMentions: boolean };
    modules?: {
        bounties?: {
            announce?: boolean;
        };
    };
    [key: string]: unknown;
}

export interface ShopConfig {
    enabled: boolean;
    categories: Record<
        string,
        {
            icon: string;
            items: Record<string, ShopItem>;
            subCategories: Record<
                string,
                {
                    icon: string;
                    items: Record<string, ShopItem>;
                }
            >;
        }
    >;
}
