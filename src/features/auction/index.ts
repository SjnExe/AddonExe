import { initializeAuctionHouse } from '@features/auction/manager.js';

export async function initialize(isMigration: boolean) {
    initializeAuctionHouse();

    // Register configurations
    const { loadAuctionHouseConfig, resetAuctionHouseConfig, registerConfigReset } = await import('@core/configurations.js');
    await loadAuctionHouseConfig(isMigration);
    registerConfigReset('auctionHouse', {
        reset: resetAuctionHouseConfig,
        message: 'The Auction House configuration section has been reset to default.'
    });
}
