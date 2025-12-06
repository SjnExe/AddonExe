// Generic Configuration Interfaces to fix 'any' types in UI handlers

// --- Command Settings ---
export interface CommandSetting {
    enabled?: boolean;
    permissionLevel?: number;
}

export type CommandSettingsConfig = Record<string, CommandSetting>;

// --- Shop Configuration ---
export interface ShopItem {
    buyPrice: number;
    sellPrice: number;
    icon?: string;
    displayName?: string;
    permissionLevel?: number;
    itemId?: string;
}

export interface ShopSubCategory {
    icon?: string;
    items: Record<string, ShopItem>;
}

export interface ShopCategory {
    icon?: string;
    items: Record<string, ShopItem>;
    subCategories: Record<string, ShopSubCategory>;
}

export interface ShopConfig {
    enabled: boolean;
    categories: Record<string, ShopCategory>;
}

export interface BaseShopEntry {
    type: 'subCategory' | 'item';
}

export interface ShopSubCategoryEntry extends BaseShopEntry, ShopSubCategory {
    type: 'subCategory';
    name: string;
}

export interface ShopItemEntry extends BaseShopEntry, ShopItem {
    type: 'item';
    id: string;
}

export type ShopListEntry = ShopSubCategoryEntry | ShopItemEntry;

// --- Team Configuration ---
export interface TeamConfig {
    enabled: boolean;
    maxMembers: number;
    creationCost: number;
    nameMinLength: number;
    nameMaxLength: number;
}

// --- Kit Configuration ---
export interface KitItem {
    typeId: string;
    amount: number;
}

export interface KitDefinition {
    enabled: boolean;
    cooldownSeconds: number;
    items: KitItem[];
    description?: string;
    icon?: string;
    permissionLevel?: number;
    price?: number;
}

export interface KitsConfig {
    enabled: boolean;
    kitDefinitions: Record<string, KitDefinition>;
}

// --- Economy Configuration ---
export interface EconomyConfig {
    enabled: boolean;
    mobMoney?: Record<string, number>;
}

// --- Rank Configuration ---
export interface RankDefinition {
    id: string;
    name: string;
    permissionLevel: number;
    chatFormatting?: {
        nameColor?: string;
        messageColor?: string;
        prefixText?: string;
    };
    nametagPrefix?: string;
}

export interface RanksConfig {
    nameTagStyle: string;
    ranks: RankDefinition[];
}

// --- X-Ray Configuration ---
export interface MonitoredBlock {
    blockId: string;
    dimensionId?: string;
    minY?: number;
    maxY?: number;
}

export interface MonitoredOre {
    oreName: string;
    blocks: MonitoredBlock[];
    enabled?: boolean;
}

export interface XrayConfig {
    enabled: boolean;
    monitoredOreTypes: Record<string, MonitoredOre>;
}

// --- General/Main Configuration ---
export interface MainConfig {
    shop: { enabled: boolean };
    kits: { enabled: boolean };
    ranks?: { nameTagStyle?: string };
    commandSettings?: CommandSettingsConfig;
    serverName?: string;
    [key: string]: unknown; // Allow other properties
}
