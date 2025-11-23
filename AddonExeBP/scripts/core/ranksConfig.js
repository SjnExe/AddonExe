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
    prefixText: '§8Member',
    nameColor: '§7',
    messageColor: '§f'
};

/** @type {RankDefinition[]} */
export const rankDefinitions = [
    {
        id: 'owner',
        name: 'Owner',
        permissionLevel: 0,
        locked: true,
        chatFormatting: {
            prefixText: '§4Owner',
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
        locked: true,
        chatFormatting: {
            prefixText: '§cAdmin',
            nameColor: '§c',
            messageColor: '§f'
        },
        nametagPrefix: '§cAdmin',
        conditions: [
            { type: 'hasTag', value: 'admin' }
        ]
    },
    {
        id: 'moderator',
        name: 'Moderator',
        permissionLevel: 2,
        chatFormatting: {
            prefixText: '§2Mod',
            nameColor: '§a',
            messageColor: '§f'
        },
        nametagPrefix: '§2Mod',
        conditions: [
            { type: 'hasTag', value: 'moderator' }
        ]
    },
    {
        id: 'helper',
        name: 'Helper',
        permissionLevel: 500,
        chatFormatting: {
            prefixText: '§eHelper',
            nameColor: '§e',
            messageColor: '§f'
        },
        nametagPrefix: '§eHelper',
        conditions: [
            { type: 'hasTag', value: 'helper' }
        ]
    },
    {
        id: 'donator',
        name: 'Donator',
        permissionLevel: 850,
        chatFormatting: {
            prefixText: '§dDonator',
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
            prefixText: '§6VIP',
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
        permissionLevel: 700,
        chatFormatting: {
            prefixText: '§bVerified',
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
        locked: true,
        chatFormatting: defaultChatFormatting,
        nametagPrefix: '§8Member',
        conditions: [
            { type: 'default' }
        ]
    }
];
