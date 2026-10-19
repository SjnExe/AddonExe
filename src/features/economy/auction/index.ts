import { initializeAuctionHouse } from '@features/economy/auction/manager.js';

export async function initialize(_isMigration: boolean) {
    initializeAuctionHouse();

    // Register configurations
    const { resetAuctionHouseConfig, registerConfigReset } = await import('@core/config/configurations.js');
    registerConfigReset('auctionHouse', {
        reset: resetAuctionHouseConfig,
        message: 'The Auction House configuration section has been reset to default.'
    });
}
