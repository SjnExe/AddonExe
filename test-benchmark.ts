import { performance } from 'perf_hooks';

interface RankDefinition {
    id: string;
    name: string;
    priority: number;
}

const rankDefinitions: RankDefinition[] = [];
for (let i = 0; i < 10000; i++) {
    rankDefinitions.push({ id: `rank_${i}`, name: `Rank ${i}`, priority: i });
}

function updateRankOld(rankId: string) {
    const index = rankDefinitions.findIndex((r) => r.id === rankId);
    return index;
}

const cache = new Map<string, number>();
function updateRankNew(rankId: string) {
    let index = cache.get(rankId);
    if (index !== undefined && rankDefinitions[index]?.id === rankId) {
        return index;
    }
    cache.clear();
    for (let i = 0; i < rankDefinitions.length; i++) {
        cache.set(rankDefinitions[i].id, i);
    }
    return cache.get(rankId) ?? -1;
}

// Warmup
for (let i = 0; i < 1000; i++) {
    updateRankOld(`rank_${i}`);
    updateRankNew(`rank_${i}`);
}

const startOld = performance.now();
for (let i = 0; i < 10000; i++) {
    updateRankOld(`rank_9999`); // Worst case for old
}
const endOld = performance.now();

const startNew = performance.now();
for (let i = 0; i < 10000; i++) {
    updateRankNew(`rank_9999`);
}
const endNew = performance.now();

console.log(`Old: ${(endOld - startOld).toFixed(2)} ms`);
console.log(`New: ${(endNew - startNew).toFixed(2)} ms`);
