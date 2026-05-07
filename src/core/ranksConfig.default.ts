export interface ChatFormatting {
    prefixText?: string;
    nameColor?: string;
    messageColor?: string;
}

export interface RankCondition {
    type: string;
    value?: unknown;
}

export interface RankDefinition {
    id: string;
    name: string;
    permissionLevel: number;
    locked?: boolean;
    chatFormatting?: ChatFormatting;
    nametagPrefix?: string;
    conditions: RankCondition[];
}

export const defaultChatFormatting: Required<ChatFormatting> = {
    prefixText: '§8Member',
    nameColor: '§7',
    messageColor: '§f'
};

export const rankDefinitions: RankDefinition[] = [
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
        conditions: [{ type: 'isOwner' }]
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
        conditions: [{ type: 'hasTag', value: 'admin' }]
    },
    {
        id: 'moderator',
        name: 'Moderator',
        permissionLevel: 3,
        chatFormatting: {
            prefixText: '§2Mod',
            nameColor: '§a',
            messageColor: '§f'
        },
        nametagPrefix: '§2Mod',
        conditions: [{ type: 'hasTag', value: 'moderator' }]
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
        conditions: [{ type: 'hasTag', value: 'helper' }]
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
        conditions: [{ type: 'hasTag', value: 'donator' }]
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
        conditions: [{ type: 'hasTag', value: 'vip' }]
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
        conditions: [{ type: 'hasTag', value: 'verified' }]
    },
    {
        id: 'member',
        name: 'Member',
        permissionLevel: 1024, // Default permission level
        locked: true,
        chatFormatting: defaultChatFormatting,
        nametagPrefix: '§8Member',
        conditions: [{ type: 'default' }]
    }
];

export default { rankDefinitions, defaultChatFormatting };
