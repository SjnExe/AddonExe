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
    defaultDurationSeconds: 86400, // 24 Hours
    allowBidding: true,
    blockedItemIds: [
        'minecraft:shulker_box',
        'minecraft:undyed_shulker_box',
        'minecraft:white_shulker_box',
        'minecraft:orange_shulker_box',
        'minecraft:magenta_shulker_box',
        'minecraft:light_blue_shulker_box',
        'minecraft:yellow_shulker_box',
        'minecraft:lime_shulker_box',
        'minecraft:pink_shulker_box',
        'minecraft:gray_shulker_box',
        'minecraft:light_gray_shulker_box',
        'minecraft:cyan_shulker_box',
        'minecraft:purple_shulker_box',
        'minecraft:blue_shulker_box',
        'minecraft:brown_shulker_box',
        'minecraft:green_shulker_box',
        'minecraft:red_shulker_box',
        'minecraft:black_shulker_box',
        'minecraft:bundle'
    ]
};
