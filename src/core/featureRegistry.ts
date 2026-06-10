// Auto-generated file. Do not edit directly.

export interface FeatureModule {
    initialize?: (isMigration: boolean) => void | Promise<void>;
}

export const featureRegistry = [
    { id: 'anticheat', load: () => import('@features/anticheat/index.js') as Promise<FeatureModule> },
    { id: 'economy', load: () => import('@features/economy/index.js') as Promise<FeatureModule> },
    { id: 'auction', load: () => import('@features/auction/index.js') as Promise<FeatureModule> },
    { id: 'daily', load: () => import('@features/daily/index.js') as Promise<FeatureModule> },
    { id: 'essentials', load: () => import('@features/essentials/index.js') as Promise<FeatureModule> },
    { id: 'kit', load: () => import('@features/kit/index.js') as Promise<FeatureModule> },
    { id: 'moderation', load: () => import('@features/moderation/index.js') as Promise<FeatureModule> },
    { id: 'shop', load: () => import('@features/shop/index.js') as Promise<FeatureModule> },
    { id: 'sidebar', load: () => import('@features/sidebar/index.js') as Promise<FeatureModule> },
    { id: 'social', load: () => import('@features/social/index.js') as Promise<FeatureModule> },
    { id: 'team', load: () => import('@features/team/index.js') as Promise<FeatureModule> },
    { id: 'teleport', load: () => import('@features/teleport/index.js') as Promise<FeatureModule> },
    { id: 'vote', load: () => import('@features/vote/index.js') as Promise<FeatureModule> },
];
