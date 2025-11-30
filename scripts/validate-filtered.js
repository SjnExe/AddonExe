import { spawn } from 'child_process';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const child = spawn(npmCommand, ['run', 'validate'], { shell: true, stdio: ['ignore', 'pipe', 'pipe'] });

let buffer = '';

child.stdout.on('data', (data) => {
    buffer += data.toString();
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || ''; // Keep the last partial line

    lines.forEach((line) => {
        // Strip ANSI codes for matching text content
        // eslint-disable-next-line no-control-regex
        const cleanLine = line.replace(/\x1B\[\d+m/g, '');

        if (
            cleanLine.includes('RECOMMENDATION:') ||
            cleanLine.includes('UNKNOWN:') ||
            cleanLine.includes('TESTSUCCESS:') ||
            cleanLine.includes('Test Success:') ||
            cleanLine.includes('> app@') ||
            cleanLine.includes('> npx mct') ||
            (cleanLine.includes('UNLINK323') && cleanLine.includes('minecraft:stick')) ||
            cleanLine.trim() === ''
        ) {
            return;
        }
        process.stdout.write(line + '\n');
    });
});

child.stderr.pipe(process.stderr);

child.on('close', (code) => {
    if (buffer.trim()) {
        // Process trailing buffer
        // eslint-disable-next-line no-control-regex
        const cleanLine = buffer.replace(/\x1B\[\d+m/g, '');
        if (
            !cleanLine.includes('RECOMMENDATION:') &&
            !cleanLine.includes('UNKNOWN:') &&
            !cleanLine.includes('TESTSUCCESS:')
        ) {
            process.stdout.write(buffer + '\n');
        }
    }
    process.exit(code);
});
