import fs from 'fs';
function disableLint() {
    let timer = fs.readFileSync('src/core/__tests__/timerManager.test.ts', 'utf-8');
    timer = '/* eslint-disable @typescript-eslint/no-unnecessary-condition */\n' + timer;
    fs.writeFileSync('src/core/__tests__/timerManager.test.ts', timer);

    let flag = fs.readFileSync('src/features/anticheat/__tests__/FlagManager.test.ts', 'utf-8');
    flag = '/* eslint-disable @typescript-eslint/no-unnecessary-condition */\n' + flag;
    fs.writeFileSync('src/features/anticheat/__tests__/FlagManager.test.ts', flag);

    let move = fs.readFileSync('src/features/anticheat/__tests__/MovementCheck.test.ts', 'utf-8');
    move = '/* eslint-disable @typescript-eslint/no-unnecessary-condition */\n' + move;
    fs.writeFileSync('src/features/anticheat/__tests__/MovementCheck.test.ts', move);

    let admin = fs.readFileSync('src/features/shop/__tests__/adminManager.test.ts', 'utf-8');
    admin = '/* eslint-disable @typescript-eslint/no-unnecessary-condition */\n' + admin;
    fs.writeFileSync('src/features/shop/__tests__/adminManager.test.ts', admin);

    let mod = fs.readFileSync('src/features/moderation/__tests__/ModerationHierarchy.test.ts', 'utf-8');
    mod = '/* eslint-disable @typescript-eslint/no-unnecessary-condition */\n' + mod;
    fs.writeFileSync('src/features/moderation/__tests__/ModerationHierarchy.test.ts', mod);

    let back = fs.readFileSync('src/features/teleport/__tests__/BackCommand.test.ts', 'utf-8');
    back = '/* eslint-disable @typescript-eslint/no-unnecessary-condition */\n' + back;
    fs.writeFileSync('src/features/teleport/__tests__/BackCommand.test.ts', back);

    let kit = fs.readFileSync('src/features/kit/__tests__/itemsManager.test.ts', 'utf-8');
    kit = '/* eslint-disable @typescript-eslint/no-unnecessary-condition */\n' + kit;
    fs.writeFileSync('src/features/kit/__tests__/itemsManager.test.ts', kit);

    let team = fs.readFileSync('src/features/team/__tests__/manager.test.ts', 'utf-8');
    team = '/* eslint-disable @typescript-eslint/no-unnecessary-condition */\n' + team;
    fs.writeFileSync('src/features/team/__tests__/manager.test.ts', team);
}
disableLint();
