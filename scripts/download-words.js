import fs from 'fs/promises';

async function main() {
    const url = 'https://raw.githubusercontent.com/first20hours/google-10000-english/master/google-10000-english-no-swears.txt';
    const response = await fetch(url);
    const text = await response.text();
    const allWords = text.split('\n');

    const words4 = allWords.filter((w) => w.length === 4);
    const words5 = allWords.filter((w) => w.length === 5);
    const words6 = allWords.filter((w) => w.length === 6);

    // Compress using simple chunking (join with no delimiter since they are fixed length)
    const compressed4 = words4.join('');
    const compressed5 = words5.join('');
    const compressed6 = words6.join('');

    const output = `// Auto-generated word pool for Wordle
export const compressedValidWords: Record<number, string> = {
    4: "${compressed4}",
    5: "${compressed5}",
    6: "${compressed6}"
};

// Top 500 words for each length are used as possible solutions
export const compressedSolutionWords: Record<number, string> = {
    4: "${words4.slice(0, 500).join('')}",
    5: "${words5.slice(0, 500).join('')}",
    6: "${words6.slice(0, 500).join('')}"
};
`;

    await fs.writeFile('src/features/games/wordle/wordPool.ts', output);
    console.log('Word pool generated successfully.');
}

main().catch(console.error);
