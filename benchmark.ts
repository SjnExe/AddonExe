const NUM_ITERATIONS = 500000;
const mockSystems = [
    { category: 'Moderation' },
    { category: 'Server' },
    { category: 'System' },
    { category: 'Economy' },
    { category: 'Gameplay' },
    { category: 'Moderation' }, // duplicate
    { category: 'Economy' }, // duplicate
    { category: undefined }, // edge case
    { category: '' } // edge case
];

function runBaseline() {
    const start = performance.now();
    for (let i = 0; i < NUM_ITERATIONS; i++) {
        const categories = new Set<string>();
        for (const sys of mockSystems) {
            if (sys.category !== undefined && sys.category.length > 0) categories.add(sys.category);
        }
        const sortedCategories = [...categories].toSorted((a, b) => a.localeCompare(b));
    }
    const end = performance.now();
    console.log(`baseline ([...categories].toSorted): ${end - start}ms`);
}

function runOptimized() {
    const start = performance.now();
    for (let i = 0; i < NUM_ITERATIONS; i++) {
        const categories = new Set<string>();
        for (const sys of mockSystems) {
            if (sys.category !== undefined && sys.category.length > 0) categories.add(sys.category);
        }
        const sortedCategories = [...categories].sort((a, b) => a.localeCompare(b));
    }
    const end = performance.now();
    console.log(`optimized ([...categories].sort): ${end - start}ms`);
}

runBaseline();
runOptimized();
