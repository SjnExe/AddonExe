import { MinecraftItemTypes } from '@minecraft/vanilla-data';

export interface AuctionHouseConfig {
    enabled: boolean;
    taxRate: number; // 0.0 to 1.0 (e.g. 0.05 for 5%)
    listingFee: number; // Flat fee
    maxListingsPerPlayer: number;
    defaultDurationSeconds: number;
    allowBidding: boolean;
    blockedItemIds: string[];
}

export const auctionHouseConfig: AuctionHouseConfig = {
    enabled: true,
    taxRate: 0.05,
    listingFee: 0,
    maxListingsPerPlayer: 5,
    defaultDurationSeconds: 86_400, // 24 Hours
    allowBidding: true,
    blockedItemIds: [
        MinecraftItemTypes.UndyedShulkerBox,
        MinecraftItemTypes.UndyedShulkerBox,
        MinecraftItemTypes.WhiteShulkerBox,
        MinecraftItemTypes.OrangeShulkerBox,
        MinecraftItemTypes.MagentaShulkerBox,
        MinecraftItemTypes.LightBlueShulkerBox,
        MinecraftItemTypes.YellowShulkerBox,
        MinecraftItemTypes.LimeShulkerBox,
        MinecraftItemTypes.PinkShulkerBox,
        MinecraftItemTypes.GrayShulkerBox,
        MinecraftItemTypes.LightGrayShulkerBox,
        MinecraftItemTypes.CyanShulkerBox,
        MinecraftItemTypes.PurpleShulkerBox,
        MinecraftItemTypes.BlueShulkerBox,
        MinecraftItemTypes.BrownShulkerBox,
        MinecraftItemTypes.GreenShulkerBox,
        MinecraftItemTypes.RedShulkerBox,
        MinecraftItemTypes.BlackShulkerBox,
        MinecraftItemTypes.Bundle
    ]
};
