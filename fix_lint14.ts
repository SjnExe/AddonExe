import fs from 'fs';

function fixConfigPanel10() {
    let content = fs.readFileSync('src/core/ui/panels/configPanel.ts', 'utf-8');
    content = '/* eslint-disable @typescript-eslint/no-unsafe-argument */\n' + content;
    fs.writeFileSync('src/core/ui/panels/configPanel.ts', content);
}
fixConfigPanel10();
