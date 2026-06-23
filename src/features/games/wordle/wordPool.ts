export const validWords: Record<number, string[]> = {
    4: ['tree', 'wood', 'dirt', 'gold', 'iron', 'sand', 'coal', 'snow', 'boat', 'fish'],
    5: ['apple', 'block', 'stone', 'sword', 'chest', 'sheep', 'water', 'glass', 'grass', 'bread', 'horse', 'slime', 'stick', 'wheat'],
    6: ['potion', 'spider', 'zombie', 'silver', 'copper', 'bucket', 'button', 'carpet', 'cookie', 'gravel', 'ladder', 'leaves', 'quartz']
};

export const solutionWords: Record<number, string[]> = {
    4: ['tree', 'wood', 'dirt', 'gold', 'iron'],
    5: ['apple', 'block', 'stone', 'sword', 'chest'],
    6: ['potion', 'spider', 'zombie', 'silver', 'copper']
};

export function isValidWord(word: string): boolean {
    const len = word.length;
    if (!validWords[len]) return false;
    return validWords[len].includes(word.toLowerCase());
}

export function getRandomSolution(length: number): string | undefined {
    const words = solutionWords[length];
    if (!words || words.length === 0) return undefined;
    return words[Math.floor(Math.random() * words.length)];
}
