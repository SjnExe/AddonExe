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
  taxRate: 0.08,
  listingFee: 15,
  maxListingsPerPlayer: 5,
  defaultDurationSeconds: 86_400, // 24 Hours
  allowBidding: true,
  blockedItemIds: [MinecraftItemTypes.Bundle],
};
