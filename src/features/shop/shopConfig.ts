export interface ShopItem {
    buyPrice: number;
    sellPrice: number;
    permissionLevel: number;
    icon?: string;
    displayName?: string;
    itemId?: string;
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
                diamond: { buyPrice: 1000, sellPrice: 500, permissionLevel: 1024 },
                emerald: { buyPrice: 800, sellPrice: 400, permissionLevel: 1024 },
                goldIngot: { buyPrice: 100, sellPrice: 50, permissionLevel: 1024 },
                ironIngot: { buyPrice: 50, sellPrice: 25, permissionLevel: 1024 },
                netheriteIngot: { buyPrice: 10_000, sellPrice: 5000, permissionLevel: 1024 },
                netheriteScrap: { buyPrice: 2000, sellPrice: 1000, permissionLevel: 1024 },
                ancientDebris: { buyPrice: 1800, sellPrice: 900, permissionLevel: 1024 },
                lapisLazuli: { buyPrice: 20, sellPrice: 10, permissionLevel: 1024 },
                quartz: { buyPrice: 30, sellPrice: 15, permissionLevel: 1024 }
            },
            subCategories: {}
        },
        'Special Items': {
            icon: 'textures/ui/filledStar',
            items: {
                totemOfUndying: { buyPrice: 5000, sellPrice: 2500, permissionLevel: 1024 },
                netherStar: { buyPrice: 20_000, sellPrice: -1, permissionLevel: 1024 },
                shulkerShell: { buyPrice: 750, sellPrice: 300, permissionLevel: 1024 },
                elytra: { buyPrice: 15_000, sellPrice: -1, permissionLevel: 1024 },
                witherSkeletonSkull: { buyPrice: 8000, sellPrice: 2000, permissionLevel: 1024 },
                enchantedGoldenApple: { buyPrice: 25_000, sellPrice: -1, permissionLevel: 1024 }
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
                        diamondSword: { buyPrice: 2500, sellPrice: 1000, permissionLevel: 1024 },
                        diamondPickaxe: { buyPrice: 3500, sellPrice: 1200, permissionLevel: 1024 },
                        diamondAxe: { buyPrice: 3500, sellPrice: 1200, permissionLevel: 1024 },
                        diamondShovel: { buyPrice: 1500, sellPrice: 600, permissionLevel: 1024 },
                        diamondHoe: { buyPrice: 2500, sellPrice: 1000, permissionLevel: 1024 }
                    }
                },
                Netherite: {
                    icon: 'textures/items/netherite_ingot',
                    items: {
                        netheriteSword: { buyPrice: 15_000, sellPrice: 7500, permissionLevel: 1024 },
                        netheritePickaxe: { buyPrice: 18_000, sellPrice: 8000, permissionLevel: 1024 }
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
                        diamondHelmet: { buyPrice: 5000, sellPrice: 2000, permissionLevel: 1024 },
                        diamondChestplate: { buyPrice: 8000, sellPrice: 3500, permissionLevel: 1024 },
                        diamondLeggings: { buyPrice: 7000, sellPrice: 3000, permissionLevel: 1024 },
                        diamondBoots: { buyPrice: 4000, sellPrice: 1800, permissionLevel: 1024 }
                    }
                },
                Netherite: {
                    icon: 'textures/items/netherite_ingot',
                    items: {
                        netheriteHelmet: { buyPrice: 20_000, sellPrice: 10_000, permissionLevel: 1024 },
                        netheriteChestplate: { buyPrice: 30_000, sellPrice: 15_000, permissionLevel: 1024 },
                        netheriteLeggings: { buyPrice: 25_000, sellPrice: 12_000, permissionLevel: 1024 },
                        netheriteBoots: { buyPrice: 18_000, sellPrice: 9000, permissionLevel: 1024 }
                    }
                }
            }
        },
        Logs: {
            icon: 'textures/blocks/sapling_oak',
            items: {
                oakLog: { buyPrice: 20, sellPrice: 10, permissionLevel: 1024 },
                spruceLog: { buyPrice: 20, sellPrice: 10, permissionLevel: 1024 },
                birchLog: { buyPrice: 20, sellPrice: 10, permissionLevel: 1024 },
                jungleLog: { buyPrice: 20, sellPrice: 10, permissionLevel: 1024 },
                acaciaLog: { buyPrice: 20, sellPrice: 10, permissionLevel: 1024 },
                darkOakLog: { buyPrice: 20, sellPrice: 10, permissionLevel: 1024 },
                mangroveLog: { buyPrice: 20, sellPrice: 10, permissionLevel: 1024 },
                cherryLog: { buyPrice: 20, sellPrice: 10, permissionLevel: 1024 },
                crimsonStem: { buyPrice: 25, sellPrice: 12, permissionLevel: 1024 },
                warpedStem: { buyPrice: 25, sellPrice: 12, permissionLevel: 1024 }
            },
            subCategories: {}
        },
        'Building Blocks': {
            icon: 'textures/blocks/stonebrick',
            items: {
                stone: { buyPrice: 10, sellPrice: 5, permissionLevel: 1024 },
                cobblestone: { buyPrice: 5, sellPrice: 1, permissionLevel: 1024 },
                dirt: { buyPrice: 2, sellPrice: 1, permissionLevel: 1024 },
                sand: { buyPrice: 5, sellPrice: 2, permissionLevel: 1024 },
                gravel: { buyPrice: 5, sellPrice: 2, permissionLevel: 1024 },
                glass: { buyPrice: 15, sellPrice: 5, permissionLevel: 1024 },
                terracotta: { buyPrice: 10, sellPrice: 5, permissionLevel: 1024 },
                whiteConcrete: { buyPrice: 20, sellPrice: 10, permissionLevel: 1024 },
                stoneBricks: { buyPrice: 12, sellPrice: 6, permissionLevel: 1024 },
                obsidian: { buyPrice: 100, sellPrice: 50, permissionLevel: 1024 },
                glowstone: { buyPrice: 80, sellPrice: 40, permissionLevel: 1024 },
                netherrack: { buyPrice: 5, sellPrice: 1, permissionLevel: 1024 },
                endStone: { buyPrice: 10, sellPrice: 2, permissionLevel: 1024 },
                purpurBlock: { buyPrice: 15, sellPrice: 5, permissionLevel: 1024 }
            },
            subCategories: {}
        },
        Food: {
            icon: 'textures/items/bread',
            items: {
                steak: { buyPrice: 20, sellPrice: 10, permissionLevel: 1024 },
                cookedPorkchop: { buyPrice: 20, sellPrice: 10, permissionLevel: 1024 },
                bread: { buyPrice: 15, sellPrice: 5, permissionLevel: 1024 },
                goldenCarrot: { buyPrice: 100, sellPrice: 40, permissionLevel: 1024 },
                cookedSalmon: { buyPrice: 20, sellPrice: 10, permissionLevel: 1024 },
                cookedCod: { buyPrice: 20, sellPrice: 10, permissionLevel: 1024 },
                chorusFruit: { buyPrice: 50, sellPrice: 25, permissionLevel: 1024 }
            },
            subCategories: {}
        },
        Farming: {
            icon: 'textures/items/diamond_hoe',
            items: {
                wheat: { buyPrice: 5, sellPrice: 2, permissionLevel: 1024 },
                carrot: { buyPrice: 5, sellPrice: 2, permissionLevel: 1024 },
                potato: { buyPrice: 5, sellPrice: 2, permissionLevel: 1024 },
                melonSlice: { buyPrice: 3, sellPrice: 1, permissionLevel: 1024 },
                pumpkin: { buyPrice: 10, sellPrice: 5, permissionLevel: 1024 },
                sugarCane: { buyPrice: 8, sellPrice: 4, permissionLevel: 1024 }
            },
            subCategories: {
                Potions: {
                    icon: 'textures/items/potion_bottle_empty',
                    items: {
                        netherWart: { buyPrice: 25, sellPrice: 10, permissionLevel: 1024 }
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
                        enchantMending: { buyPrice: 8000, sellPrice: -1, permissionLevel: 1024 },
                        enchantUnbreaking3: { buyPrice: 4000, sellPrice: -1, permissionLevel: 1024 }
                    }
                },
                Sword: {
                    icon: 'textures/items/diamond_sword',
                    items: {
                        enchantSharpness5: { buyPrice: 5000, sellPrice: -1, permissionLevel: 1024 },
                        enchantLooting3: { buyPrice: 3000, sellPrice: -1, permissionLevel: 1024 },
                        enchantFireAspect2: { buyPrice: 2000, sellPrice: -1, permissionLevel: 1024 }
                    }
                },
                Armour: {
                    icon: 'textures/items/diamond_chestplate',
                    items: {
                        enchantProtection4: { buyPrice: 4500, sellPrice: -1, permissionLevel: 1024 },
                        enchantFeatherFalling4: { buyPrice: 3500, sellPrice: -1, permissionLevel: 1024 }
                    }
                },
                Tools: {
                    icon: 'textures/items/diamond_pickaxe',
                    items: {
                        enchantEfficiency5: { buyPrice: 5000, sellPrice: -1, permissionLevel: 1024 },
                        enchantFortune3: { buyPrice: 4000, sellPrice: -1, permissionLevel: 1024 },
                        enchantSilkTouch: { buyPrice: 6000, sellPrice: -1, permissionLevel: 1024 }
                    }
                },
                Bow: {
                    icon: 'textures/items/bow_standby',
                    items: {
                        enchantPower5: { buyPrice: 5000, sellPrice: -1, permissionLevel: 1024 },
                        enchantInfinity: { buyPrice: 7000, sellPrice: -1, permissionLevel: 1024 },
                        enchantFlame: { buyPrice: 2000, sellPrice: -1, permissionLevel: 1024 }
                    }
                },
                Trident: {
                    icon: 'textures/items/trident',
                    items: {
                        enchantImpaling5: { buyPrice: 3000, sellPrice: -1, permissionLevel: 1024 },
                        enchantLoyalty3: { buyPrice: 2500, sellPrice: -1, permissionLevel: 1024 },
                        enchantChanneling: { buyPrice: 4000, sellPrice: -1, permissionLevel: 1024 },
                        enchantRiptide3: { buyPrice: 3500, sellPrice: -1, permissionLevel: 1024 }
                    }
                },
                Mace: {
                    icon: 'textures/items/mace',
                    items: {
                        enchantDensity5: { buyPrice: 5000, sellPrice: -1, permissionLevel: 1024 },
                        enchantBreach4: { buyPrice: 4000, sellPrice: -1, permissionLevel: 1024 },
                        enchantWindBurst3: { buyPrice: 6000, sellPrice: -1, permissionLevel: 1024 }
                    }
                },
                Crossbow: {
                    icon: 'textures/items/crossbow_standby',
                    items: {
                        enchantMultishot1: { buyPrice: 4000, sellPrice: -1, permissionLevel: 1024 },
                        enchantPiercing4: { buyPrice: 4500, sellPrice: -1, permissionLevel: 1024 },
                        enchantQuickCharge3: { buyPrice: 3500, sellPrice: -1, permissionLevel: 1024 }
                    }
                }
            }
        }
    }
};

export default shopConfig;
