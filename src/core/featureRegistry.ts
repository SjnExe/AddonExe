// Auto-generated file. Do not edit directly.

export interface FeatureModule {
    initialize?: (isMigration: boolean, subfeatures?: Record<string, boolean>) => void | Promise<void>;
}

export const featureRegistry = [
    { id: 'economy', load: () => import('@features/economy/index.js') as Promise<FeatureModule>, dependencies: [], subfeatures: undefined },
    { id: 'games', load: () => import('@features/games/index.js') as Promise<FeatureModule>, dependencies: ["economy"], subfeatures: undefined },
    { id: 'anticheat', load: () => import('@features/anticheat/index.js') as Promise<FeatureModule>, dependencies: [], subfeatures: undefined },
    { id: 'auction', load: () => import('@features/auction/index.js') as Promise<FeatureModule>, dependencies: ["economy"], subfeatures: undefined },
    { id: 'daily', load: () => import('@features/daily/index.js') as Promise<FeatureModule>, dependencies: [], subfeatures: undefined },
    { id: 'essentials', load: () => import('@features/essentials/index.js') as Promise<FeatureModule>, dependencies: [], subfeatures: undefined },
    { id: 'kit', load: () => import('@features/kit/index.js') as Promise<FeatureModule>, dependencies: [], subfeatures: undefined },
    { id: 'moderation', load: () => import('@features/moderation/index.js') as Promise<FeatureModule>, dependencies: [], subfeatures: undefined },
    { id: 'shop', load: () => import('@features/shop/index.js') as Promise<FeatureModule>, dependencies: ["economy"], subfeatures: undefined },
    { id: 'sidebar', load: () => import('@features/sidebar/index.js') as Promise<FeatureModule>, dependencies: [], subfeatures: undefined },
    { id: 'social', load: () => import('@features/social/index.js') as Promise<FeatureModule>, dependencies: [], subfeatures: undefined },
    { id: 'team', load: () => import('@features/team/index.js') as Promise<FeatureModule>, dependencies: [], subfeatures: undefined },
    { id: 'teleport', load: () => import('@features/teleport/index.js') as Promise<FeatureModule>, dependencies: [], subfeatures: undefined },
    { id: 'vote', load: () => import('@features/vote/index.js') as Promise<FeatureModule>, dependencies: [], subfeatures: undefined },
    { id: 'ranks', load: () => import('@features/ranks/index.js') as Promise<FeatureModule>, dependencies: [], subfeatures: undefined },
];
