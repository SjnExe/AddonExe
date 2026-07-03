const mc = {
    get world() {
        // Simulating a native property getter
        return {
            getDynamicProperty: (key: string) => {
                if (key.endsWith('50000')) return undefined;
                return '[]';
            }
        };
    }
};

function testUncached() {
    const start = performance.now();
    for (let i = 0; i < 50000; i++) {
        const data = mc.world.getDynamicProperty(`prefix${i}`);
        if (data === undefined) break;
    }
    return performance.now() - start;
}

function testCached() {
    const start = performance.now();
    const world = mc.world;
    for (let i = 0; i < 50000; i++) {
        const data = world.getDynamicProperty(`prefix${i}`);
        if (data === undefined) break;
    }
    return performance.now() - start;
}

const u1 = testUncached();
const c1 = testCached();
console.log(`Uncached: ${u1}ms, Cached: ${c1}ms`);
