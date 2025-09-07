/**
 * @typedef {object} ChatFormatting
 * @property {string} [prefixText='']
 * @property {string} [nameColor='§7']
 * @property {string} [messageColor='§f']
 */

/**
 * @typedef {object} RankCondition
 * @property {string} type The type of condition to check (e.g., 'isOwner', 'hasTag').
 * @property {*} [value] The value to check against (e.g., the tag name).
 */

/**
 * @typedef {object} RankDefinition
 * @property {string} id
 * @property {string} name
 * @property {number} permissionLevel
 * @property {ChatFormatting} [chatFormatting]
 * @property {string} [nametagPrefix]
 * @property {RankCondition[]} conditions
 */

/** @type {Required<ChatFormatting>} */
export const defaultChatFormatting = {
    prefixText: '§8[§7Member§8] ',
    nameColor: '§7',
    messageColor: '§f'
};

/** @type {RankDefinition[]} */
export const rankDefinitions = [
    {
        id: 'owner',
        name: 'Owner',
        permissionLevel: 0,
        chatFormatting: {
            prefixText: '§8[§4Owner§8] ',
            nameColor: '§4',
            messageColor: '§f'
        },
        nametagPrefix: '§4Owner',
        conditions: [
            { type: 'isOwner' }
        ]
    },
    {
        id: 'admin',
        name: 'Admin',
        permissionLevel: 1,
        chatFormatting: {
            prefixText: '§8[§cAdmin§8] ',
            nameColor: '§c',
            messageColor: '§f'
        },
        nametagPrefix: '§cAdmin',
        conditions: [
            { type: 'hasTag', value: 'admin' }
        ]
    },
    {
        id: 'donator',
        name: 'Donator',
        permissionLevel: 850,
        chatFormatting: {
            prefixText: '§8[§dDonator§8] ',
            nameColor: '§d',
            messageColor: '§f'
        },
        nametagPrefix: '§dDonator',
        conditions: [
            { type: 'hasTag', value: 'donator' }
        ]
    },
    {
        id: 'vip',
        name: 'VIP',
        permissionLevel: 800,
        chatFormatting: {
            prefixText: '§8[§6VIP§8] ',
            nameColor: '§6',
            messageColor: '§f'
        },
        nametagPrefix: '§6VIP',
        conditions: [
            { type: 'hasTag', value: 'vip' }
        ]
    },
    {
        id: 'verified',
        name: 'Verified',
        permissionLevel: 200,
        chatFormatting: {
            prefixText: '§8[§bVerified§8] ',
            nameColor: '§b',
            messageColor: '§f'
        },
        nametagPrefix: '§bVerified',
        conditions: [
            { type: 'hasTag', value: 'verified' }
        ]
    },
    {
        id: 'member',
        name: 'Member',
        permissionLevel: 1024, // Default permission level
        chatFormatting: defaultChatFormatting,
        nametagPrefix: '§7Member',
        conditions: [
            { type: 'default' }
        ]
    }
];
