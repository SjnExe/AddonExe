/**
 * Default shop configuration.
 * This object will be populated by admins through the in-game 'Edit Shop' panel.
 * By default, the shop is empty. Admins enable items from the master list
 * in itemsConfig.js and can set custom prices.
 *
 * The structure for the saved config will be:
 * {
 *   version: "1.0.0", // To handle future migrations
 *   items: {
 *     // Example of an enabled item. The key corresponds to a key in itemsConfig.js.
 *     // "diamond": {
 *     //   "buyPrice": 1000,
 *     //   "sellPrice": 500
 *     // }
 *     // If an item is not in this object, it is not in the shop.
 *   }
 * }
 */
export const shopConfig = {
    version: '1.0.0',
    items: {
        diamond: {
            buyPrice: 1000,
            sellPrice: 500
        },
        ironIngot: {
            buyPrice: 50,
            sellPrice: 25
        },
        totemOfUndying: {
            buyPrice: 5000,
            sellPrice: 2500
        },
        enchantMending: {
            buyPrice: 8000,
            sellPrice: -1
        }
    }
};
