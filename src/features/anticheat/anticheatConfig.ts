export interface Violation {
    threshold: number;
    command: string;
}

export interface CheckConfig {
    enabled: boolean;
    notifyStaff: boolean;
    notifyPermissionLevel: number;
    flagDecaySeconds: number;
    violations: Violation[];
}

export const anticheatConfig = {
    enabled: false,
    consoleNotifications: true,
    itemCheck: {
        enabled: true,
        notifyStaff: true,
        notifyPermissionLevel: 2, // Mod
        flagDecaySeconds: 300,
        violations: [
            { threshold: 1, command: 'warn {player} Illegal Item detected.' },
            { threshold: 5, command: 'kick {player} Illegal Items.' },
            { threshold: 10, command: 'ban {player} 1d Illegal Items.' }
        ],
        // Specific settings
        bannedItems: ['minecraft:bedrock', 'minecraft:barrier', 'minecraft:command_block', 'minecraft:structure_block', 'minecraft:border_block'],
        illegalEnchantments: true,
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
        maxSpeed: 2.0,
        flightDetection: false
    }
};
