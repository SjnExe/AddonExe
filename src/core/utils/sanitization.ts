/**
 * Sanitizes a string by removing color codes and control characters.
 * @param input The string to sanitize.
 * @param allowColors Whether to allow § color codes. Defaults to false.
 * @returns The sanitized string.
 */
export function sanitizeString(input: string, allowColors = false): string {
    if (!input) return '';
    let result = input;

    // Remove color codes if not allowed
    if (!allowColors) {
        result = result.replaceAll(/§[0-9a-fklmnor]/g, '');
    }

    // Remove non-printable characters (basic control chars, keeping newlines/returns)
    // eslint-disable-next-line no-control-regex
    result = result.replaceAll(/[\u0000-\u0009\u000B\u000C\u000E-\u001F]/g, '');

    return result.trim();
}

/**
 * Validates that an input is safe (length check).
 * @param input The input string.
 * @param maxLength Max length.
 * @returns True if valid.
 */
export function validateInput(input: string, maxLength = 256): boolean {
    if (!input) return true;
    if (input.length > maxLength) return false;
    return true;
}

/**
 * Escapes a string to be safely used as an argument in a Minecraft command.
 * It escapes backslashes and double quotes, and replaces newlines with spaces.
 * The resulting string should be wrapped in double quotes in the command.
 * @param input The string to escape.
 * @returns The escaped string.
 */
export function escapeCommandArg(input: string): string {
    if (!input) return '';
    return input.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', ' ');
}
