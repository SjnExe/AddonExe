/**
 * Formats a string by replacing placeholders with values from a context object.
 * @param template The string template with placeholders like {key}.
 * @param context An object containing the values to substitute.
 * @returns The formatted string.
 */
/**
 * Strips Minecraft color codes from a string.
 * @param text The string to strip color codes from.
 */
export function stripColorCodes(text: string): string {
    return text.replace(/§[0-9a-fk-or]/ig, '');
}

export function formatString(template: string, context: Record<string, string | number | boolean>): string {
    if (!template) {
        return '';
    }
    // Replace \n with actual newlines first
    let message = template.replaceAll(String.raw`\n`, '\n');

    // Replace placeholders using replaceAll without RegExp overhead
    for (const key in context) {
        if (Object.prototype.hasOwnProperty.call(context, key)) {
            message = message.replaceAll(`{${key}}`, String(context[key]));
        }
    }
    return message;
}
