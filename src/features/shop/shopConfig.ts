export interface ShopItem {
    buyPrice: number;
    sellPrice: number;
    permission: string;
    icon?: string;
    displayName?: string;
    itemId?: string;
    rankMultiplierOverrides?: Record<string, { buy: number; sell: number }>;
}

export interface ShopSubCategory {
    icon: string;
    items: Record<string, ShopItem>;
}

export interface ShopCategory {
    icon: string;
    items: Record<string, ShopItem>;
    subCategories: Record<string, ShopSubCategory>;
}

export interface ShopConfig {
    categories: Record<string, ShopCategory>;
}

export const shopConfig: ShopConfig = {
    categories: {
        'Ores & Minerals': {
            icon: 'textures/ui/icon_iron_pickaxe',
            items: {
                diamond: { buyPrice: 1000, sellPrice: 500, permission: 'ui.panel.member' },
                emerald: { buyPrice: 800, sellPrice: 400, permission: 'ui.panel.member' },
                goldIngot: { buyPrice: 100, sellPrice: 50, permission: 'ui.panel.member' },
                ironIngot: { buyPrice: 50, sellPrice: 25, permission: 'ui.panel.member' },
                netheriteIngot: { buyPrice: 10_000, sellPrice: 5000, permission: 'ui.panel.member' },
                netheriteScrap: { buyPrice: 2000, sellPrice: 1000, permission: 'ui.panel.member' },
                ancientDebris: { buyPrice: 1800, sellPrice: 900, permission: 'ui.panel.member' },
                lapisLazuli: { buyPrice: 20, sellPrice: 10, permission: 'ui.panel.member' },
                quartz: { buyPrice: 30, sellPrice: 15, permission: 'ui.panel.member' }
            },
            subCategories: {}
        },
        'Special Items': {
            icon: 'textures/ui/filledStar',
            items: {
                totemOfUndying: { buyPrice: 5000, sellPrice: 2500, permission: 'ui.panel.member' },
                netherStar: { buyPrice: 20_000, sellPrice: -1, permission: 'ui.panel.member' },
                shulkerShell: { buyPrice: 750, sellPrice: 300, permission: 'ui.panel.member' },
                elytra: { buyPrice: 15_000, sellPrice: -1, permission: 'ui.panel.member' },
                witherSkeletonSkull: { buyPrice: 8000, sellPrice: 2000, permission: 'ui.panel.member' },
                enchantedGoldenApple: { buyPrice: 25_000, sellPrice: -1, permission: 'ui.panel.member' }
            },
            subCategories: {}
        },
        'Tools & Weapons': {
            icon: 'textures/items/diamond_sword',
            items: {},
            subCategories: {
                Diamond: {
                    icon: 'textures/items/diamond',
                    items: {
                        diamondSword: { buyPrice: 2500, sellPrice: 1000, permission: 'ui.panel.member' },
                        diamondPickaxe: { buyPrice: 3500, sellPrice: 1200, permission: 'ui.panel.member' },
                        diamondAxe: { buyPrice: 3500, sellPrice: 1200, permission: 'ui.panel.member' },
                        diamondShovel: { buyPrice: 1500, sellPrice: 600, permission: 'ui.panel.member' },
                        diamondHoe: { buyPrice: 2500, sellPrice: 1000, permission: 'ui.panel.member' }
                    }
                },
                Netherite: {
                    icon: 'textures/items/netherite_ingot',
                    items: {
                        netheriteSword: { buyPrice: 15_000, sellPrice: 7500, permission: 'ui.panel.member' },
                        netheritePickaxe: { buyPrice: 18_000, sellPrice: 8000, permission: 'ui.panel.member' }
                    }
                }
            }
        },
        Armor: {
            icon: 'textures/items/diamond_chestplate',
            items: {},
            subCategories: {
                Diamond: {
                    icon: 'textures/items/diamond',
                    items: {
                        diamondHelmet: { buyPrice: 5000, sellPrice: 2000, permission: 'ui.panel.member' },
                        diamondChestplate: { buyPrice: 8000, sellPrice: 3500, permission: 'ui.panel.member' },
                        diamondLeggings: { buyPrice: 7000, sellPrice: 3000, permission: 'ui.panel.member' },
                        diamondBoots: { buyPrice: 4000, sellPrice: 1800, permission: 'ui.panel.member' }
                    }
                },
                Netherite: {
                    icon: 'textures/items/netherite_ingot',
                    items: {
                        netheriteHelmet: { buyPrice: 20_000, sellPrice: 10_000, permission: 'ui.panel.member' },
                        netheriteChestplate: { buyPrice: 30_000, sellPrice: 15_000, permission: 'ui.panel.member' },
                        netheriteLeggings: { buyPrice: 25_000, sellPrice: 12_000, permission: 'ui.panel.member' },
                        netheriteBoots: { buyPrice: 18_000, sellPrice: 9000, permission: 'ui.panel.member' }
                    }
                }
            }
        },
        Logs: {
            icon: 'textures/blocks/sapling_oak',
            items: {
                oakLog: { buyPrice: 20, sellPrice: 10, permission: 'ui.panel.member' },
                spruceLog: { buyPrice: 20, sellPrice: 10, permission: 'ui.panel.member' },
                birchLog: { buyPrice: 20, sellPrice: 10, permission: 'ui.panel.member' },
                jungleLog: { buyPrice: 20, sellPrice: 10, permission: 'ui.panel.member' },
                acaciaLog: { buyPrice: 20, sellPrice: 10, permission: 'ui.panel.member' },
                darkOakLog: { buyPrice: 20, sellPrice: 10, permission: 'ui.panel.member' },
                mangroveLog: { buyPrice: 20, sellPrice: 10, permission: 'ui.panel.member' },
                cherryLog: { buyPrice: 20, sellPrice: 10, permission: 'ui.panel.member' },
                crimsonStem: { buyPrice: 25, sellPrice: 12, permission: 'ui.panel.member' },
                warpedStem: { buyPrice: 25, sellPrice: 12, permission: 'ui.panel.member' }
            },
            subCategories: {}
        },
        'Building Blocks': {
            icon: 'textures/blocks/stonebrick',
            items: {
                stone: { buyPrice: 10, sellPrice: 5, permission: 'ui.panel.member' },
                cobblestone: { buyPrice: 5, sellPrice: 1, permission: 'ui.panel.member' },
                dirt: { buyPrice: 2, sellPrice: 1, permission: 'ui.panel.member' },
                sand: { buyPrice: 5, sellPrice: 2, permission: 'ui.panel.member' },
                gravel: { buyPrice: 5, sellPrice: 2, permission: 'ui.panel.member' },
                glass: { buyPrice: 15, sellPrice: 5, permission: 'ui.panel.member' },
                terracotta: { buyPrice: 10, sellPrice: 5, permission: 'ui.panel.member' },
                whiteConcrete: { buyPrice: 20, sellPrice: 10, permission: 'ui.panel.member' },
                stoneBricks: { buyPrice: 12, sellPrice: 6, permission: 'ui.panel.member' },
                obsidian: { buyPrice: 100, sellPrice: 50, permission: 'ui.panel.member' },
                glowstone: { buyPrice: 80, sellPrice: 40, permission: 'ui.panel.member' },
                netherrack: { buyPrice: 5, sellPrice: 1, permission: 'ui.panel.member' },
                endStone: { buyPrice: 10, sellPrice: 2, permission: 'ui.panel.member' },
                purpurBlock: { buyPrice: 15, sellPrice: 5, permission: 'ui.panel.member' }
            },
            subCategories: {}
        },
        Food: {
            icon: 'textures/items/bread',
            items: {
                steak: { buyPrice: 20, sellPrice: 10, permission: 'ui.panel.member' },
                cookedPorkchop: { buyPrice: 20, sellPrice: 10, permission: 'ui.panel.member' },
                bread: { buyPrice: 15, sellPrice: 5, permission: 'ui.panel.member' },
                goldenCarrot: { buyPrice: 100, sellPrice: 40, permission: 'ui.panel.member' },
                cookedSalmon: { buyPrice: 20, sellPrice: 10, permission: 'ui.panel.member' },
                cookedCod: { buyPrice: 20, sellPrice: 10, permission: 'ui.panel.member' },
                chorusFruit: { buyPrice: 50, sellPrice: 25, permission: 'ui.panel.member' }
            },
            subCategories: {}
        },
        Farming: {
            icon: 'textures/items/diamond_hoe',
            items: {
                wheat: { buyPrice: 5, sellPrice: 2, permission: 'ui.panel.member' },
                carrot: { buyPrice: 5, sellPrice: 2, permission: 'ui.panel.member' },
                potato: { buyPrice: 5, sellPrice: 2, permission: 'ui.panel.member' },
                melonSlice: { buyPrice: 3, sellPrice: 1, permission: 'ui.panel.member' },
                pumpkin: { buyPrice: 10, sellPrice: 5, permission: 'ui.panel.member' },
                sugarCane: { buyPrice: 8, sellPrice: 4, permission: 'ui.panel.member' }
            },
            subCategories: {
                Potions: {
                    icon: 'textures/items/potion_bottle_empty',
                    items: {
                        netherWart: { buyPrice: 25, sellPrice: 10, permission: 'ui.panel.member' }
                    }
                }
            }
        },
        Enchantments: {
            icon: 'textures/items/book_enchanted',
            items: {},
            subCategories: {
                General: {
                    icon: 'textures/items/book_normal',
                    items: {
                        enchantMending: { buyPrice: 8000, sellPrice: -1, permission: 'ui.panel.member' },
                        enchantUnbreaking3: { buyPrice: 4000, sellPrice: -1, permission: 'ui.panel.member' }
                    }
                },
                Sword: {
                    icon: 'textures/items/diamond_sword',
                    items: {
                        enchantSharpness5: { buyPrice: 5000, sellPrice: -1, permission: 'ui.panel.member' },
                        enchantLooting3: { buyPrice: 3000, sellPrice: -1, permission: 'ui.panel.member' },
                        enchantFireAspect2: { buyPrice: 2000, sellPrice: -1, permission: 'ui.panel.member' }
                    }
                },
                Armour: {
                    icon: 'textures/items/diamond_chestplate',
                    items: {
                        enchantProtection4: { buyPrice: 4500, sellPrice: -1, permission: 'ui.panel.member' },
                        enchantFeatherFalling4: { buyPrice: 3500, sellPrice: -1, permission: 'ui.panel.member' }
                    }
                },
                Tools: {
                    icon: 'textures/items/diamond_pickaxe',
                    items: {
                        enchantEfficiency5: { buyPrice: 5000, sellPrice: -1, permission: 'ui.panel.member' },
                        enchantFortune3: { buyPrice: 4000, sellPrice: -1, permission: 'ui.panel.member' },
                        enchantSilkTouch: { buyPrice: 6000, sellPrice: -1, permission: 'ui.panel.member' }
                    }
                },
                Bow: {
                    icon: 'textures/items/bow_standby',
                    items: {
                        enchantPower5: { buyPrice: 5000, sellPrice: -1, permission: 'ui.panel.member' },
                        enchantInfinity: { buyPrice: 7000, sellPrice: -1, permission: 'ui.panel.member' },
                        enchantFlame: { buyPrice: 2000, sellPrice: -1, permission: 'ui.panel.member' }
                    }
                },
                Trident: {
                    icon: 'textures/items/trident',
                    items: {
                        enchantImpaling5: { buyPrice: 3000, sellPrice: -1, permission: 'ui.panel.member' },
                        enchantLoyalty3: { buyPrice: 2500, sellPrice: -1, permission: 'ui.panel.member' },
                        enchantChanneling: { buyPrice: 4000, sellPrice: -1, permission: 'ui.panel.member' },
                        enchantRiptide3: { buyPrice: 3500, sellPrice: -1, permission: 'ui.panel.member' }
                    }
                },
                Mace: {
                    icon: 'textures/items/mace',
                    items: {
                        enchantDensity5: { buyPrice: 5000, sellPrice: -1, permission: 'ui.panel.member' },
                        enchantBreach4: { buyPrice: 4000, sellPrice: -1, permission: 'ui.panel.member' },
                        enchantWindBurst3: { buyPrice: 6000, sellPrice: -1, permission: 'ui.panel.member' }
                    }
                },
                Crossbow: {
                    icon: 'textures/items/crossbow_standby',
                    items: {
                        enchantMultishot1: { buyPrice: 4000, sellPrice: -1, permission: 'ui.panel.member' },
                        enchantPiercing4: { buyPrice: 4500, sellPrice: -1, permission: 'ui.panel.member' },
                        enchantQuickCharge3: { buyPrice: 3500, sellPrice: -1, permission: 'ui.panel.member' }
                    }
                }
            }
        }
    }
};

export default shopConfig;
