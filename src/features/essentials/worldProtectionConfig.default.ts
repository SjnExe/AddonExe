export type WorldProtectionZone = {
    id: string;
    name: string;
    dimension: string;
    box: {
        min: { x: number; y: number; z: number };
        max: { x: number; y: number; z: number };
    };
    flags: {
        preventPvP: boolean;
        preventHostileDamage: boolean;
        preventHostileMobSpawning: boolean;
        preventBlockBreaking: boolean;
        preventBlockPlacing: boolean;
        preventExplosions: boolean;
        preventBlockInteraction: boolean;
    };
};

export type WorldProtectionConfig = typeof worldProtectionConfig;
export const worldProtectionConfig = {
    zones: [] as WorldProtectionZone[]
};

export default worldProtectionConfig;
