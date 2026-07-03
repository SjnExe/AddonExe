import { performance } from 'perf_hooks';

interface RankDefinition {
    id: string;
    name: string;
}

const ranksConfig = {
    rankDefinitions: [] as RankDefinition[]
};

for (let i = 0; i < 1000; i++) {
    ranksConfig.rankDefinitions.push({ id: `rank_${i}`, name: `Rank ${i}` });
}

function getRankByIdOld(rankId: string) {
    return ranksConfig.rankDefinitions.find((r) => r.id === rankId);
}

const rankIndexCache = new Map<string, number>();

function getRankIndex(ranks: RankDefinition[], rankId: string): number {
    const index = rankIndexCache.get(rankId);
    if (index !== undefined && ranks[index]?.id === rankId) {
        return index;
    }

    rankIndexCache.clear();
    for (let i = 0; i < ranks.length; i++) {
        rankIndexCache.set(ranks[i].id, i);
    }

    return rankIndexCache.get(rankId) ?? -1;
}

function getRankByIdNew(rankId: string) {
    const ranks = ranksConfig.rankDefinitions;
    const index = getRankIndex(ranks, rankId);
    return index !== -1 ? ranks[index] : undefined;
}

// Warmup
for (let i = 0; i < 1000; i++) {
    getRankByIdOld(`rank_${i}`);
    getRankByIdNew(`rank_${i}`);
}

const iters = 10000;
const targetId = 'rank_999';

const startOld = performance.now();
for (let i = 0; i < iters; i++) {
    getRankByIdOld(targetId);
}
const endOld = performance.now();

const startNew = performance.now();
for (let i = 0; i < iters; i++) {
    getRankByIdNew(targetId);
}
const endNew = performance.now();

console.log(`Old: ${(endOld - startOld).toFixed(3)} ms`);
console.log(`New: ${(endNew - startNew).toFixed(3)} ms`);
