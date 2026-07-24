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
    priority: number;
    locked?: boolean;
    chatFormatting?: ChatFormatting;
    nametagPrefix?: string;
    conditions: RankCondition[];
    groups: string[];
    allow: string[];
    deny: string[];
    shopMultiplier?: {
        buy: number;
        sell: number;
    };
}

export const defaultChatFormatting: Required<ChatFormatting> = {
    prefixText: '§8Member',
    nameColor: '§7',
    messageColor: '§f'
};

export const permissionGroups: Record<string, string[]> = {
    default: ['**.member'],
    mod: ['**.mod'],
    admin: ['**.admin'],
    owner: ['**.owner']
};

export const rankDefinitions: RankDefinition[] = [
    {
        id: 'owner',
        name: 'Owner',
        priority: 0,
        locked: true,
        chatFormatting: {
            prefixText: '§4Owner',
            nameColor: '§4',
            messageColor: '§f'
        },
        nametagPrefix: '§4Owner',
        conditions: [{ type: 'isOwner' }],
        groups: ['default', 'mod', 'admin', 'owner'],
        allow: ['*'], // Engine will handle this specifically if needed, but 'owner' bypassing is hardcoded in engine
        deny: []
    },
    {
        id: 'admin',
        name: 'Admin',
        priority: 10,
        chatFormatting: {
            prefixText: '§cAdmin',
            nameColor: '§c',
            messageColor: '§f'
        },
        nametagPrefix: '§cAdmin',
        conditions: [{ type: 'hasTag', value: 'admin' }],
        groups: ['default', 'mod', 'admin'],
        allow: [],
        deny: []
    },
    {
        id: 'moderator',
        name: 'Moderator',
        priority: 30,
        chatFormatting: {
            prefixText: '§2Mod',
            nameColor: '§a',
            messageColor: '§f'
        },
        nametagPrefix: '§2Mod',
        conditions: [{ type: 'hasTag', value: 'moderator' }],
        groups: ['default', 'mod'],
        allow: [],
        deny: []
    },
    {
        id: 'helper',
        name: 'Helper',
        priority: 50,
        chatFormatting: {
            prefixText: '§eHelper',
            nameColor: '§e',
            messageColor: '§f'
        },
        nametagPrefix: '§eHelper',
        conditions: [{ type: 'hasTag', value: 'helper' }],
        groups: ['default'],
        allow: ['cmd.kick.mod', 'cmd.mute.mod'], // Specific permissions just for example
        deny: []
    },
    {
        id: 'donator',
        name: 'Donator',
        priority: 850,
        chatFormatting: {
            prefixText: '§dDonator',
            nameColor: '§d',
            messageColor: '§f'
        },
        nametagPrefix: '§dDonator',
        conditions: [{ type: 'hasTag', value: 'donator' }],
        groups: ['default'],
        allow: [],
        deny: [],
        shopMultiplier: { buy: 0.9, sell: 1.1 } // 10% discount on buy, 10% bonus on sell
    },
    {
        id: 'vip',
        name: 'VIP',
        priority: 800,
        chatFormatting: {
            prefixText: '§6VIP',
            nameColor: '§6',
            messageColor: '§f'
        },
        nametagPrefix: '§6VIP',
        conditions: [{ type: 'hasTag', value: 'vip' }],
        groups: ['default'],
        allow: [],
        deny: [],
        shopMultiplier: { buy: 0.8, sell: 1.2 } // 20% discount on buy, 20% bonus on sell
    },
    {
        id: 'verified',
        name: 'Verified',
        priority: 700,
        chatFormatting: {
            prefixText: '§bVerified',
            nameColor: '§b',
            messageColor: '§f'
        },
        nametagPrefix: '§bVerified',
        conditions: [{ type: 'hasTag', value: 'verified' }],
        groups: ['default'],
        allow: [],
        deny: []
    },
    {
        id: 'member',
        name: 'Member',
        priority: 1000,
        locked: true,
        chatFormatting: defaultChatFormatting,
        nametagPrefix: '§8Member',
        conditions: [],
        groups: ['default'],
        allow: [],
        deny: []
    }
];

export default { rankDefinitions, permissionGroups, defaultChatFormatting };
