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
    vip: ['**.vip'],
    builder: ['**.builder', 'cmd.gmc.builder', 'cmd.gms.builder', 'cmd.gamemode.builder', 'bypass.spawnprotection'],
    helper: ['**.helper', 'cmd.kick.mod', 'cmd.mute.mod', 'cmd.unmute.mod', 'cmd.warn.mod', 'cmd.freeze.mod', 'cmd.unfreeze.mod', 'cmd.staffchat.mod', 'cmd.watch.mod', 'cmd.listwatched.mod'],
    mod: ['**.mod', '**.helper'],
    admin: ['**.admin', '**.mod', '**.helper', '**.builder', '**.vip'],
    owner: ['**.owner', '*']
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
        conditions: [{ type: 'hasTag', value: 'owner' }],
        groups: ['default', 'vip', 'builder', 'helper', 'mod', 'admin', 'owner'],
        allow: ['*'],
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
        groups: ['default', 'vip', 'builder', 'helper', 'mod', 'admin'],
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
        groups: ['default', 'helper', 'mod'],
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
        groups: ['default', 'helper'],
        allow: ['cmd.kick.mod', 'cmd.mute.mod', 'cmd.unmute.mod', 'cmd.warn.mod', 'cmd.staffchat.mod'],
        deny: []
    },
    {
        id: 'builder',
        name: 'Builder',
        priority: 60,
        chatFormatting: {
            prefixText: '§3Builder',
            nameColor: '§3',
            messageColor: '§f'
        },
        nametagPrefix: '§3Builder',
        conditions: [{ type: 'hasTag', value: 'builder' }],
        groups: ['default', 'builder'],
        allow: ['cmd.gmc.builder', 'cmd.gms.builder', 'cmd.gamemode.builder', 'bypass.spawnprotection'],
        deny: []
    },
    {
        id: 'media',
        name: 'Media',
        priority: 650,
        chatFormatting: {
            prefixText: '§5Media',
            nameColor: '§d',
            messageColor: '§f'
        },
        nametagPrefix: '§5Media',
        conditions: [{ type: 'hasTag', value: 'media' }],
        groups: ['default', 'vip'],
        allow: [],
        deny: [],
        shopMultiplier: { buy: 0.85, sell: 1.15 }
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
        id: 'mvp',
        name: 'MVP',
        priority: 750,
        chatFormatting: {
            prefixText: '§bMVP',
            nameColor: '§b',
            messageColor: '§f'
        },
        nametagPrefix: '§bMVP',
        conditions: [{ type: 'hasTag', value: 'mvp' }],
        groups: ['default', 'vip'],
        allow: [],
        deny: [],
        shopMultiplier: { buy: 0.75, sell: 1.25 }
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
        groups: ['default', 'vip'],
        allow: [],
        deny: [],
        shopMultiplier: { buy: 0.8, sell: 1.2 }
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
        groups: ['default', 'vip'],
        allow: [],
        deny: [],
        shopMultiplier: { buy: 0.9, sell: 1.1 }
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
