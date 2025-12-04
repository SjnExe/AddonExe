export interface Violation {
    threshold: number;
    command: string;
}

export interface BaseCheckConfig {
    enabled: boolean;
    notifyStaff: boolean;
    notifyPermissionLevel: number;
    flagDecaySeconds: number;
    violations: Violation[];
}

export interface ItemCheckConfig extends BaseCheckConfig {
    bannedItems: string[];
    illegalEnchantments: boolean;
    maxEnchantLevel: number;
    removeIllegalItems: boolean;
}

export interface MovementCheckConfig extends BaseCheckConfig {
    maxSpeed: number; // Base walking/sprinting
    maxSpeedIce: number; // Speed on ice/slime
    maxSpeedElytra: number; // Speed while gliding
    flightDetection: boolean;
}

export interface WorldBorderConfig {
    enabled: boolean;
    overworldRadius: number;
    endRadius: number;
    netherRadiusRatio: number;
    center: { x: number; z: number } | null;
    knockbackAmount: number;
}

export interface AntiNetherRoofConfig {
    enabled: boolean;
    maxHeight: number;
}

export interface AnticheatConfig {
    enabled: boolean;
    consoleNotifications: boolean;
    itemCheck: ItemCheckConfig;
    movementCheck: MovementCheckConfig;
    worldBorder: WorldBorderConfig;
    antiNetherRoof: AntiNetherRoofConfig;
}

export const anticheatConfig: AnticheatConfig = {
    enabled: false,
    consoleNotifications: true,
    itemCheck: {
        enabled: false,
        notifyStaff: true,
        notifyPermissionLevel: 2, // Mod
        flagDecaySeconds: 300,
        violations: [
            { threshold: 1, command: 'warn {player} Illegal Item detected.' },
            { threshold: 5, command: 'kick {player} Illegal Items.' },
            { threshold: 10, command: 'ban {player} 1d Illegal Items.' }
        ],
        bannedItems: [
            'minecraft:bedrock',
            'minecraft:barrier',
            'minecraft:command_block',
            'minecraft:structure_block',
            'minecraft:border_block'
        ],
        illegalEnchantments: true,
        maxEnchantLevel: 5,
        removeIllegalItems: true
    },
    movementCheck: {
        enabled: false,
        notifyStaff: true,
        notifyPermissionLevel: 2,
        flagDecaySeconds: 60,
        violations: [
            { threshold: 10, command: 'warn {player} Moving too fast.' },
            { threshold: 20, command: 'kick {player} Suspicious movement.' }
        ],
        maxSpeed: 10.0, // Strict walking speed
        maxSpeedIce: 25.0, // Ice/Slime allowance
        maxSpeedElytra: 80.0, // Gliding allowance
        flightDetection: false
    },
    worldBorder: {
        enabled: false,
        overworldRadius: 5000,
        endRadius: 5000,
        netherRadiusRatio: 8,
        center: null, // Use world spawn by default
        knockbackAmount: 3
    },
    antiNetherRoof: {
        enabled: false,
        maxHeight: 128
    }
};
