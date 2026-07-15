import fs from 'fs';

function fixPlayerCache3() {
    let content = fs.readFileSync('src/core/playerCache.ts', 'utf-8');
    content = content.replace(/player\.name\.toLowerCase\(\)/g, '(player.name || "").toLowerCase()');
    fs.writeFileSync('src/core/playerCache.ts', content);
}
fixPlayerCache3();
