/**
 * Formats a string by replacing placeholders with values from a context object.
 * @param template The string template with placeholders like {key}.
 * @param context An object containing the values to substitute.
 * @returns The formatted string.
 */
export function formatString(template: string, context: Record<string, string | number | boolean>): string {
    if (!template) {
        return '';
    }
    // Replace \n with actual newlines first
    let message = template.replaceAll(String.raw`\n`, '\n');

    // Replace placeholders
    for (const key in context) {
        if (Object.prototype.hasOwnProperty.call(context, key)) {
            const placeholder = new RegExp(`{${key}}`, 'g');
            message = message.replace(placeholder, String(context[key]));
        }
    }
    return message;
}
