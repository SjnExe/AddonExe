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
    /** The minimum permission level required to see this button. */
    permissionLevel: number;
    /** The action to perform when clicked. */
    actionType: 'openPanel' | 'functionCall';
    /** The ID of the panel to open or the function to call. */
    actionValue: string;
    /** An optional number to control the order of items. Lower numbers appear first. */
    sortId?: number;
}

export interface PanelDefinition {
    /** The title of the panel. */
    title: string;
    /** The ID of the parent panel for back navigation. null for top-level panels. */
    parentPanelId: string | null;
    /** The buttons to display on this panel. */
    items: PanelItem[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type UIContext = Record<string, any>;
