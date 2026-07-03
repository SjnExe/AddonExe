const entries: [string, string][] = Array.from({ length: 10000 }, (_, i) => [`key${i}`, `val${i}`]);

function testForOf() {
    const map = new Map<string, string>();
    const start = performance.now();
    for (const [k, v] of entries) map.set(k, v);
    return performance.now() - start;
}

function testForLoop() {
    const map = new Map<string, string>();
    const start = performance.now();
    const len = entries.length;
    for (let i = 0; i < len; i++) {
        const e = entries[i];
        map.set(e[0], e[1]);
    }
    return performance.now() - start;
}

let totalForOf = 0;
let totalForLoop = 0;

for (let i = 0; i < 100; i++) {
    totalForOf += testForOf();
    totalForLoop += testForLoop();
}

console.log(`for...of: ${totalForOf.toFixed(2)}ms, for loop: ${totalForLoop.toFixed(2)}ms`);
