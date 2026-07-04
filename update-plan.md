1. **Create an inline plugin to compress the wordPool during build**
   - Add a new esbuild plugin in `scripts/build.ts` that intercepts the loading of `src/features/games/wordle/wordPool.ts`.
   - The plugin will parse the plain string representation of words.
   - It will slice it into words of length `L`.
   - It will sort the first `SOLUTION_LIMIT` words separately from the rest of the pool.
   - It will compress the combined sorted array using prefix compression (where each word is stored as a single base36 digit representing how many starting characters it shares with the previous word, followed by the rest of the word).
   - The plugin returns the modified content to the bundler.

2. **Update `src/features/games/wordle/wordPool.ts`**
   - Change `compressedWordPool` to plain strings (uncompressed, just continuous strings of length `N` characters per word). The name of the variable can stay `compressedWordPool` for less breakage, or we can change it to `wordPool` and handle the decompression at runtime. Let's rename it to `wordPool` inside this file but keep the export if needed. Let's rename the constant to `compressedWordPool` inside `wordPool.ts`, wait, the prompt says "the wordpool should be plain(can be in the format where every 5 letter words are one string with no divider), and the build step will compress it".
   - It's already in that format right now! Currently `compressedWordPool` just holds plain strings of words. Wait, no, `compressedWordPool` IS currently a plain string of words! "compressedWordPool" is a misnomer in the existing code.
   - We will rename `compressedWordPool` to `wordPool` in `wordPool.ts` to be accurate. But wait, we'll keep `compressedWordPool` but add decompression logic.
   - Actually, let's create a new `decompressedWordPool` variable initialized lazily.
   - The string inside `compressedWordPool` will be prefix-compressed by the build step.
   - In `wordPool.ts`, we write a decompression function that takes the compressed string and returns the plain string or an array of strings, or just modifies `isValidWord` to work with the decompressed version.
   - Since memory is a bit of a concern, we should decompress it into a single long string or array of strings at runtime.
   - Update `isValidWord` and `getRandomSolution` to use the decompressed pool.

3. **Complete pre commit steps**
   - Complete pre commit steps to make sure proper testing, verifications, reviews and reflections are done.

4. **Submit**
