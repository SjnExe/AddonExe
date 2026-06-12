import { loadAuctionHouseConfig } from '@core/configurations.js';
import { initializeAuctionHouse } from '@features/auction/manager.js';

export async function initialize(isMigration: boolean) {
    await loadAuctionHouseConfig(isMigration);
    initializeAuctionHouse();
}
