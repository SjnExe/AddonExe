import { MinecraftItemTypes } from '@minecraft/vanilla-data';

export const kitsConfig = {
  enabled: false,
  starterKit: {
    enabled: false,
    kitName: 'starter',
  },
  kitDefinitions: {
    starter: {
      enabled: true,
      description: 'A basic kit to get you started.',
      cooldownSeconds: 3600, // 1 hour
      icon: 'textures/items/stone_sword',
      price: 0,
      permission: 'ui.panel.member',
      items: [
        { typeId: MinecraftItemTypes.StoneSword, amount: 1 },
        { typeId: MinecraftItemTypes.StonePickaxe, amount: 1 },
        { typeId: MinecraftItemTypes.StoneAxe, amount: 1 },
        { typeId: MinecraftItemTypes.StoneShovel, amount: 1 },
        { typeId: MinecraftItemTypes.Bread, amount: 16 },
      ],
    },
    food: {
      enabled: true,
      description: 'A hearty food refill.',
      cooldownSeconds: 900, // 15 minutes
      icon: 'textures/items/beef_cooked',
      price: 25,
      permission: 'ui.panel.member',
      items: [{ typeId: MinecraftItemTypes.CookedBeef, amount: 16 }],
    },
    warrior: {
      enabled: true,
      description: 'A kit for the aspiring warrior.',
      cooldownSeconds: 86_400, // 24 hours
      icon: 'textures/items/iron_sword',
      price: 350,
      permission: 'ui.panel.member',
      items: [
        { typeId: MinecraftItemTypes.IronSword, amount: 1 },
        { typeId: MinecraftItemTypes.IronHelmet, amount: 1 },
        { typeId: MinecraftItemTypes.IronChestplate, amount: 1 },
        { typeId: MinecraftItemTypes.IronLeggings, amount: 1 },
        { typeId: MinecraftItemTypes.IronBoots, amount: 1 },
        { typeId: MinecraftItemTypes.Shield, amount: 1 },
        { typeId: MinecraftItemTypes.CookedBeef, amount: 16 },
      ],
    },
    archer: {
      enabled: true,
      description: 'A kit for the skilled archer.',
      cooldownSeconds: 86_400, // 24 hours
      icon: 'textures/items/bow_standby',
      price: 250,
      permission: 'ui.panel.member',
      items: [
        { typeId: MinecraftItemTypes.Bow, amount: 1 },
        { typeId: MinecraftItemTypes.Arrow, amount: 64 },
        { typeId: MinecraftItemTypes.LeatherHelmet, amount: 1 },
        { typeId: MinecraftItemTypes.LeatherChestplate, amount: 1 },
        { typeId: MinecraftItemTypes.LeatherLeggings, amount: 1 },
        { typeId: MinecraftItemTypes.LeatherBoots, amount: 1 },
        { typeId: MinecraftItemTypes.CookedChicken, amount: 16 },
      ],
    },
    miner: {
      enabled: true,
      description: 'A kit for the dedicated miner.',
      cooldownSeconds: 43_200, // 12 hours
      icon: 'textures/items/iron_pickaxe',
      price: 150,
      permission: 'ui.panel.member',
      items: [
        { typeId: MinecraftItemTypes.IronPickaxe, amount: 1 },
        { typeId: MinecraftItemTypes.IronShovel, amount: 1 },
        { typeId: MinecraftItemTypes.Torch, amount: 64 },
        { typeId: MinecraftItemTypes.Coal, amount: 16 },
        { typeId: MinecraftItemTypes.Bread, amount: 16 },
      ],
    },
    builder: {
      enabled: true,
      description: 'A kit for the creative builder.',
      cooldownSeconds: 86_400, // 24 hours
      icon: 'textures/blocks/planks_oak',
      price: 300,
      permission: 'ui.panel.member',
      items: [
        { typeId: MinecraftItemTypes.OakLog, amount: 64 },
        { typeId: MinecraftItemTypes.OakLog, amount: 64 },
        { typeId: MinecraftItemTypes.Glass, amount: 64 },
        { typeId: MinecraftItemTypes.StoneBricks, amount: 64 },
      ],
    },
  },
};

export default kitsConfig;
