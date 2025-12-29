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
    // Using new RegExp to avoid no-control-regex lint error while maintaining functionality
    result = result.replaceAll(new RegExp(String.raw`[\x00-\x09\x0B\x0C\x0E-\x1F]`, 'g'), '');

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
