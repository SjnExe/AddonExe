/**
 * Sanitizes a string by removing color codes and control characters.
 *
 * @param input The string to sanitize.
 * @param allowColors Whether to allow § color codes. Defaults to false.
 * @returns The sanitized string.
 */
export function sanitizeString(input: string, allowColors = false): string {
  if (!input) {
    return '';
  }
  let result = input;

  if (!allowColors) {
    result = result.replaceAll(/§[0-9a-fklmnor]/gi, '');
  }

  let cleaned = '';
  for (let i = 0; i < result.length; i++) {
    const code = result.charCodeAt(i);
    if (code >= 0x20 || code === 0x0a || code === 0x0d) {
      cleaned += result[i];
    }
  }
  result = cleaned;

  return result.trim();
}

/**
 * Validates that an input is safe (length check).
 *
 * @param input The input string.
 * @param maxLength Max length.
 * @returns True if valid.
 */
export function validateInput(input: string, maxLength = 256): boolean {
  if (!input) {
    return true;
  }
  if (input.length > maxLength) {
    return false;
  }
  return true;
}

/**
 * Escapes a string to be safely used as an argument in a Minecraft command. It replaces double quotes with single
 * quotes, removes backslashes to prevent escaping the closing quote, and replaces newlines with spaces. The resulting
 * string should be wrapped in double quotes in the command.
 *
 * @param input The string to escape.
 * @returns The escaped string.
 */
export function escapeCommandArg(input: string): string {
  if (!input) {
    return '';
  }
  return input.replaceAll('\\', '').replaceAll('"', "'").replaceAll('\n', ' ');
}
