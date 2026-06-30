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
    permissionLevel: number; // Temporary for transition
    locked?: boolean;
    chatFormatting?: ChatFormatting;
    nametagPrefix?: string;
    conditions: RankCondition[];
    groups: string[];
    allow: string[];
    deny: string[];
}

export const defaultChatFormatting: Required<ChatFormatting> = {
    prefixText: '§8Member',
    nameColor: '§7',
    messageColor: '§f'
};

export const permissionGroups: Record<string, string[]> = {
    default: [
        'cmd.help',
        'cmd.spawn',
        'cmd.tpa',
        'cmd.tpahere',
        'cmd.home',
        'cmd.sethome',
        'cmd.delhome',
        'cmd.pay',
        'cmd.balance',
        'cmd.bounty',
        'cmd.rtp',
        'cmd.daily',
        'cmd.kit',
        'cmd.team',
        'cmd.vote',
        'cmd.panel',
        'ui.panel.member'
    ],
    mod: ['cmd.kick', 'cmd.mute', 'cmd.unmute', 'cmd.freeze', 'cmd.unfreeze', 'cmd.inventory', 'cmd.vanish', 'ui.panel.mod'],
    admin: ['cmd.ban', 'cmd.unban', 'cmd.tp', 'cmd.warp', 'cmd.setbalance', 'ui.panel.admin'],
    owner: ['cmd.op', 'ui.panel.owner', 'cmd.debug', 'cmd.status', 'cmd.fixplayer', 'cmd.deathcoords']
};

export const rankDefinitions: RankDefinition[] = [
    {
        id: 'owner',
        name: 'Owner',
        priority: 0,
        permissionLevel: 0,
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
        permissionLevel: 1,
        locked: true,
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
        permissionLevel: 3,
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
        permissionLevel: 500,
        chatFormatting: {
            prefixText: '§eHelper',
            nameColor: '§e',
            messageColor: '§f'
        },
        nametagPrefix: '§eHelper',
        conditions: [{ type: 'hasTag', value: 'helper' }],
        groups: ['default'],
        allow: ['cmd.kick', 'cmd.mute'], // Specific permissions just for example
        deny: []
    },
    {
        id: 'donator',
        name: 'Donator',
        priority: 850,
        permissionLevel: 850,
        chatFormatting: {
            prefixText: '§dDonator',
            nameColor: '§d',
            messageColor: '§f'
        },
        nametagPrefix: '§dDonator',
        conditions: [{ type: 'hasTag', value: 'donator' }],
        groups: ['default'],
        allow: [],
        deny: []
    },
    {
        id: 'vip',
        name: 'VIP',
        priority: 800,
        permissionLevel: 800,
        chatFormatting: {
            prefixText: '§6VIP',
            nameColor: '§6',
            messageColor: '§f'
        },
        nametagPrefix: '§6VIP',
        conditions: [{ type: 'hasTag', value: 'vip' }],
        groups: ['default'],
        allow: [],
        deny: []
    },
    {
        id: 'verified',
        name: 'Verified',
        priority: 700,
        permissionLevel: 700,
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
        permissionLevel: 1024,
        locked: true,
        chatFormatting: defaultChatFormatting,
        nametagPrefix: '§8Member',
        conditions: [{ type: 'default' }],
        groups: ['default'],
        allow: [],
        deny: []
    }
];

export default { rankDefinitions, permissionGroups, defaultChatFormatting };
