export interface FeatureModule {
    initialize?: (isMigration: boolean, subfeatures?: Record<string, boolean>) => void | Promise<void>;
}

export type FeatureStatus = 'prod' | 'dev';

export interface RawFeatureDef {
    id: string;
    name: string;
    status: FeatureStatus;
    dependencies?: string[];
    subfeatures?: Record<string, FeatureStatus>;
    load: () => Promise<FeatureModule>;
}

const isProduction = process.env.NODE_ENV === 'production';

// The raw list of features
export const RAW_FEATURES: RawFeatureDef[] = [
    {
        id: 'anticheat',
        name: 'Anti-Cheat',
        status: 'prod',
        dependencies: [],
        load: () => import('@features/anticheat/index.js')
    },
    {
        id: 'daily',
        name: 'Daily Rewards',
        status: 'prod',
        dependencies: [],
        load: () => import('@features/daily/index.js')
    },
    {
        id: 'economy',
        name: 'Economy',
        status: 'prod',
        dependencies: [],
        load: () => import('@features/economy/index.js')
    },
    {
        id: 'essentials',
        name: 'Essentials',
        status: 'prod',
        dependencies: [],
        load: () => import('@features/essentials/index.js')
    },
    {
        id: 'kit',
        name: 'Kits',
        status: 'prod',
        dependencies: [],
        load: () => import('@features/kit/index.js')
    },
    {
        id: 'moderation',
        name: 'Moderation',
        status: 'prod',
        dependencies: [],
        load: () => import('@features/moderation/index.js')
    },
    {
        id: 'shop',
        name: 'Shop',
        status: 'prod',
        dependencies: ['economy'],
        load: () => import('@features/shop/index.js')
    },
    {
        id: 'social',
        name: 'Social',
        status: 'prod',
        dependencies: [],
        load: () => import('@features/social/index.js')
    },
    {
        id: 'teleport',
        name: 'Teleport',
        status: 'prod',
        dependencies: [],
        load: () => import('@features/teleport/index.js')
    },
    {
        id: 'vote',
        name: 'Voting',
        status: 'prod',
        dependencies: [],
        load: () => import('@features/vote/index.js')
    },
    {
        id: 'ranks',
        name: 'Ranks',
        status: 'prod',
        dependencies: [],
        load: () => import('@features/ranks/index.js')
    }
];

if (!isProduction) {
    RAW_FEATURES.push(
        {
            id: 'games',
            name: 'Games',
            status: 'dev',
            dependencies: ['economy'],
            load: () => import('@features/games/index.js')
        },
        {
            id: 'auction',
            name: 'Auction House',
            status: 'dev',
            dependencies: ['economy'],
            load: () => import('@features/auction/index.js')
        },
        {
            id: 'sidebar',
            name: 'Sidebar',
            status: 'dev',
            dependencies: [],
            load: () => import('@features/sidebar/index.js')
        },
        {
            id: 'team',
            name: 'Teams',
            status: 'dev',
            dependencies: [],
            load: () => import('@features/team/index.js')
        }
    );
}


export interface ProcessedFeature {
    id: string;
    load: () => Promise<FeatureModule>;
    dependencies: string[];
    subfeatures?: Record<string, boolean>;
}

function processFeatures(): ProcessedFeature[] {
    const enabledFeatures = RAW_FEATURES.filter(f => {
        if (isProduction && f.status === 'dev') {
            return false;
        }
        return true;
    });

    const featureMap = new Map<string, RawFeatureDef>();
    for (const f of enabledFeatures) {
        featureMap.set(f.id, f);
    }

    // Validate dependencies
    for (const feature of enabledFeatures) {
        for (const dep of feature.dependencies || []) {
            if (!featureMap.has(dep)) {
                throw new Error(`[ERROR] Feature '${feature.id}' depends on '${dep}', which is not enabled or does not exist.`);
            }
        }
    }

    // Topologically sort based on dependencies
    const sortedFeatures: RawFeatureDef[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    function visit(featureId: string) {
        if (visited.has(featureId)) return;
        if (visiting.has(featureId)) {
            throw new Error(`[ERROR] Circular dependency detected involving feature '${featureId}'.`);
        }

        const feature = featureMap.get(featureId);
        if (!feature) return;

        visiting.add(featureId);

        for (const dep of feature.dependencies || []) {
            visit(dep);
        }

        visiting.delete(featureId);
        visited.add(featureId);
        sortedFeatures.push(feature);
    }

    for (const [id] of featureMap) {
        if (!visited.has(id)) {
            visit(id);
        }
    }

    return sortedFeatures.map(f => {
        let activeSubfeatures: Record<string, boolean> | undefined = undefined;
        if (f.subfeatures) {
            activeSubfeatures = {};
            for (const [subId, status] of Object.entries(f.subfeatures)) {
                if (isProduction && status === 'dev') {
                    activeSubfeatures[subId] = false;
                } else {
                    activeSubfeatures[subId] = true;
                }
            }
        }

        return {
            id: f.id,
            load: f.load,
            dependencies: f.dependencies || [],
            subfeatures: activeSubfeatures
        };
    });
}

export const featureRegistry: ProcessedFeature[] = processFeatures();
