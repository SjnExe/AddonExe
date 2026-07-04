const compressedWordPool: Record<number, string> = {
    4: 'abcd0efgh',
    5: 'apple4y0zebra'
};

const plainWordPool: Record<number, string> = {};

for (const [lenStr, compressed] of Object.entries(compressedWordPool)) {
    const wordLen = parseInt(lenStr, 10);
    if (!compressed) {
        plainWordPool[wordLen] = '';
        continue;
    }

    let decompressed = compressed.substring(0, wordLen);
    let prevWord = decompressed;
    let idx = wordLen;
    while (idx < compressed.length) {
        const shared = parseInt(compressed[idx], 36);
        idx++;
        const restLen = wordLen - shared;
        const restStr = compressed.substring(idx, idx + restLen);
        idx += restLen;
        const currWord = prevWord.substring(0, shared) + restStr;
        decompressed += currWord;
        prevWord = currWord;
    }
    plainWordPool[wordLen] = decompressed;
}
console.log(plainWordPool);
