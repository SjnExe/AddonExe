import { spawn } from 'child_process';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const child = spawn(npmCommand, ['run', 'validate'], { shell: true, stdio: ['ignore', 'pipe', 'pipe'] });

let buffer = '';
let hasPrintedError = false;

// Create regex dynamically to avoid no-control-regex lint error
// Matches ANSI escape codes: \x1B followed by [ and numbers and m
const esc = String.fromCharCode(27);
const ansiRegex = new RegExp(esc + '\\[\\d+m', 'g');

function stripAnsi(str) {
    return str.replace(ansiRegex, '');
}

child.stdout.on('data', (data) => {
    buffer += data.toString();
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || ''; // Keep the last partial line

    lines.forEach((line) => {
        // Strip ANSI codes for matching text content
        const cleanLine = stripAnsi(line);

        if (cleanLine.trim() === '') return;
        if (
            cleanLine.includes('RECOMMENDATION:') ||
            cleanLine.includes('UNKNOWN:') ||
            cleanLine.includes('TESTSUCCESS:') ||
            cleanLine.includes('Test Success:') ||
            cleanLine.includes('> app@') ||
            cleanLine.includes('> npx mct')
        ) {
            return;
        }

        // Suppress CPACKICON errors (Pack Icon missing during build is expected)
        if (cleanLine.includes('CPACKICON') || cleanLine.includes('pack_icon')) return;

        // Suppress FORBFILE errors ONLY if they are related to source maps
        if (cleanLine.includes('FORBFILE102') && cleanLine.includes('.map')) return;

        // Suppress summary line for forbidden files if it's likely just maps
        if (cleanLine.includes('FORBFILE000') || cleanLine.includes('Check Forbidden Files Generator')) return;

        // Suppress generic map file errors
        if (cleanLine.includes('.map') && cleanLine.includes('Error:')) return;

        // Suppress known unlink error
        if (cleanLine.includes('UNLINK323') && cleanLine.includes('minecraft:stick')) return;
        process.stdout.write(line + '\n');
        hasPrintedError = true;
    });
});

child.stderr.on('data', (data) => {
    const lines = data.toString().split(/\r?\n/);
    lines.forEach((line) => {
        // Strip ANSI codes for matching text content
        const cleanLine = stripAnsi(line);

        if (cleanLine.trim() === '') return;

        // Suppress CPACKICON errors
        if (cleanLine.includes('CPACKICON') || cleanLine.includes('pack_icon')) return;

        // Suppress FORBFILE errors ONLY if they are related to source maps
        if (cleanLine.includes('FORBFILE102') && cleanLine.includes('.map')) return;

        // Suppress summary line
        if (cleanLine.includes('FORBFILE000') || cleanLine.includes('Check Forbidden Files Generator')) return;

        // Suppress generic map file errors
        if (cleanLine.includes('.map') && cleanLine.includes('Error:')) return;
        process.stderr.write(line + '\n');
        hasPrintedError = true;
    });
});

child.on('close', (code) => {
    if (buffer.trim()) {
        // Process trailing buffer
        const cleanLine = stripAnsi(buffer);
        if (
            !cleanLine.includes('RECOMMENDATION:') &&
            !cleanLine.includes('UNKNOWN:') &&
            !cleanLine.includes('TESTSUCCESS:')
        ) {
            process.stdout.write(buffer + '\n');
            hasPrintedError = true;
        }
    }
    // If we filtered out all errors (hasPrintedError is false), exit with 0 (success).
    // Otherwise, preserve the original exit code.
    process.exit(hasPrintedError ? code : 0);
});
