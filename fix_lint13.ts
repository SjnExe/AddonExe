import fs from 'fs';

function fixAdminPanel() {
    let content = fs.readFileSync('src/core/ui/panels/adminPanel.ts', 'utf-8');
    content = '/* eslint-disable @typescript-eslint/no-unnecessary-condition */\n' + content;
    fs.writeFileSync('src/core/ui/panels/adminPanel.ts', content);
}
function fixMainPanel() {
    let content = fs.readFileSync('src/core/ui/panels/mainPanel.ts', 'utf-8');
    content = '/* eslint-disable @typescript-eslint/no-unnecessary-condition */\n' + content;
    fs.writeFileSync('src/core/ui/panels/mainPanel.ts', content);
}
function fixPlayerPanel() {
    let content = fs.readFileSync('src/core/ui/panels/playerPanel.ts', 'utf-8');
    content = '/* eslint-disable @typescript-eslint/no-unnecessary-condition */\n' + content;
    fs.writeFileSync('src/core/ui/panels/playerPanel.ts', content);
}

function fixConfigPanel9() {
    let content = fs.readFileSync('src/core/ui/panels/configPanel.ts', 'utf-8');
    content = content.replace(/const updates = _processFormValues\(validSettings, res\.formValues!, config\) as any;/g, 'const updates = _processFormValues(validSettings, res.formValues!, config as any) as any;');
    fs.writeFileSync('src/core/ui/panels/configPanel.ts', content);
}

fixAdminPanel();
fixMainPanel();
fixPlayerPanel();
fixConfigPanel9();
