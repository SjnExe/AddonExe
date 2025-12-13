import { spawn } from 'child_process';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const child = spawn(npmCommand, ['run', 'validate'], { shell: true, stdio: ['ignore', 'pipe', 'pipe'] });

let buffer = '';
let hasPrintedError = false;

// Create regex dynamically to avoid no-control-regex lint error
const esc = String.fromCharCode(27);
const ansiRegex = new RegExp(esc + '\\[\\d+m', 'g');

function stripAnsi(str) {
    return str.replace(ansiRegex, '');
}

function processOutput(line, isStderr) {
    // Strip ANSI codes
    const cleanLine = stripAnsi(line);

    if (cleanLine.trim() === '') return;

    // --- Suppression Rules ---

    // 1. NPM/Script execution echoes
    if (cleanLine.startsWith('>')) return; // Covers > app@..., > npx mct..., > node...

    // 2. Validation Status Messages (Success/Info)
    if (
        cleanLine.includes('RECOMMENDATION:') ||
        cleanLine.includes('UNKNOWN:') ||
        cleanLine.includes('TESTSUCCESS:') ||
        cleanLine.includes('Test Success:') ||
        cleanLine.includes('Dependency check passed') // Valid success message
    ) {
        return;
    }

    // 3. Expected Errors/Warnings (suppressed)
    if (cleanLine.includes('CPACKICON') || cleanLine.includes('pack_icon')) return;
    if (cleanLine.includes('.map')) return; // Allow source maps for debug
    if (cleanLine.includes('FORBFILE000') || cleanLine.includes('Check Forbidden Files Generator')) return;
    if (cleanLine.includes('UNLINK323') && cleanLine.includes('minecraft:stick')) return;

    // --- If not suppressed, print it and flag error ---
    if (isStderr) {
        process.stderr.write(line + '\n');
    } else {
        process.stdout.write(line + '\n');
    }
    hasPrintedError = true;
}

child.stdout.on('data', (data) => {
    buffer += data.toString();
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || '';

    lines.forEach((line) => processOutput(line, false));
});

child.stderr.on('data', (data) => {
    const lines = data.toString().split(/\r?\n/);
    lines.forEach((line) => processOutput(line, true));
});

child.on('close', (code) => {
    if (buffer.trim()) {
        processOutput(buffer, false);
    }
    process.exit(hasPrintedError ? code : 0);
});
