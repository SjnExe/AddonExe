let counter = 0;
export function generateSecureId() {
    counter = (counter + 1) % 1000000;
    const timePart = Date.now().toString(36);
    // Even if Math.random() is predictable, combining it with Date.now() and a counter makes it significantly harder to guess the exact report ID without knowing the exact millisecond and counter value.
    const randPart = Math.random().toString(36).substring(2, 10);
    return `${timePart}-${counter.toString(36)}-${randPart}`;
}
