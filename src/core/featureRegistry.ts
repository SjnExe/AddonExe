export interface FeatureModule {
    initialize?: (isMigration: boolean, subfeatures?: Record<string, boolean>) => void | Promise<void>;
}

export interface RawFeatureDef {
    id: string;
    name: string;
    dependencies?: string[];
    subfeatures?: Record<string, boolean>;
    load: () => Promise<FeatureModule>;
}

// The raw list of features
export const RAW_FEATURES: RawFeatureDef[] = [
    {
        id: 'ac',
        name: 'Anti-Cheat',
        dependencies: [],
        load: () => import('@features/anticheat/index.js')
    },
    {
        id: 'util.daily',
        name: 'Daily Rewards',
        dependencies: ['eco'],
        load: () => import('@features/daily/index.js')
    },
    {
        id: 'eco',
        name: 'Economy',
        dependencies: [],
        load: () => import('@features/economy/index.js')
    },
    {
        id: 'essentials',
        name: 'Essentials',
        dependencies: [],
        load: () => import('@features/essentials/index.js')
    },
    {
        id: 'util.kit',
        name: 'Kits',
        dependencies: ['eco'],
        load: () => import('@features/kit/index.js')
    },
    {
        id: 'mod',
        name: 'Moderation',
        dependencies: [],
        load: () => import('@features/moderation/index.js')
    },
    {
        id: 'eco.shop',
        name: 'Shop',
        dependencies: ['eco'],
        load: () => import('@features/shop/index.js')
    },
    {
        id: 'soc',
        name: 'Social',
        dependencies: [],
        load: () => import('@features/social/index.js')
    },
    {
        id: 'tp',
        name: 'Teleport',
        dependencies: [],
        load: () => import('@features/teleport/index.js')
    },
    {
        id: 'util.vote',
        name: 'Voting',
        dependencies: [],
        load: () => import('@features/vote/index.js')
    },
    {
        id: 'ranks',
        name: 'Ranks',
        dependencies: [],
        load: () => import('@features/ranks/index.js')
    }
];

RAW_FEATURES.push(
    {
        id: 'game',
        name: 'Games',
        dependencies: [],
        load: () => import('@features/games/index.js')
    },
    {
        id: 'eco.ah',
        name: 'Auction House',
        dependencies: ['eco'],
        load: () => import('@features/auction/index.js')
    },
    {
        id: 'util.sidebar',
        name: 'Sidebar',
        dependencies: [],
        load: () => import('@features/sidebar/index.js')
    },
    {
        id: 'soc.team',
        name: 'Teams',
        dependencies: ['eco'],
        load: () => import('@features/team/index.js')
    }
);

// @ts-ignore - __IS_NIGHTLY__ is injected via esbuild
if (typeof __IS_NIGHTLY__ !== 'undefined' && __IS_NIGHTLY__) {
    RAW_FEATURES.push({
        id: 'test',
        name: 'Testing Framework',
        dependencies: [],
        load: () => import('@features/test/index.js')
    });
}

export interface ProcessedFeature {
    id: string;
    load: () => Promise<FeatureModule>;
    dependencies: string[];
    subfeatures?: Record<string, boolean>;
}

function processFeatures(): ProcessedFeature[] {
    const enabledFeatures = RAW_FEATURES;

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

    return sortedFeatures.map((f) => {
        let activeSubfeatures: Record<string, boolean> | undefined = undefined;
        if (f.subfeatures) {
            activeSubfeatures = {};
            for (const [subId, status] of Object.entries(f.subfeatures)) {
                activeSubfeatures[subId] = status;
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
