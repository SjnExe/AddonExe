const mc = {
    _world: {
        getDynamicProperty: (key: string) => {
            return key.endsWith('1000') ? undefined : '[["k","v"]]';
        },
        setDynamicProperty: (key: string, val: any) => {}
    },
    get world() {
        // Native property getter overhead simulation
        for (let i = 0; i < 500; i++) {}
        return this._world;
    }
};

function testLoadUncached() {
    let map = new Map();
    let i = 0;
    while (true) {
        const data = mc.world.getDynamicProperty(`prefix${i}`);
        if (!data) break;
        const entries = JSON.parse(data);
        for (const [k, v] of entries) map.set(k, v);
        i++;
    }
}

function testLoadCached() {
    let map = new Map();
    let i = 0;
    const world = mc.world;
    while (true) {
        const data = world.getDynamicProperty(`prefix${i}`);
        if (!data) break;
        const entries = JSON.parse(data);
        for (let j = 0; j < entries.length; j++) {
            map.set(entries[j][0], entries[j][1]);
        }
        i++;
    }
}

const s1 = performance.now();
for (let i = 0; i < 100; i++) testLoadUncached();
const e1 = performance.now();

const s2 = performance.now();
for (let i = 0; i < 100; i++) testLoadCached();
const e2 = performance.now();

console.log(`Uncached: ${(e1 - s1).toFixed(2)}ms, Cached: ${(e2 - s2).toFixed(2)}ms`);
