/**
 * Generates an RFC 9562 compliant UUIDv7 string (time-ordered + random bits).
 * Works in both Bun test environments and Minecraft Bedrock's QuickJS runtime.
 */
export function generateUUIDv7(): string {
    const bytes = new Uint8Array(16);
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
        crypto.getRandomValues(bytes);
    } else {
        for (let i = 0; i < 16; i++) {
            bytes[i] = Math.floor(Math.random() * 256);
        }
    }

    const now = BigInt(Date.now());
    bytes[0] = Number((now >> 40n) & 0xffn);
    bytes[1] = Number((now >> 32n) & 0xffn);
    bytes[2] = Number((now >> 24n) & 0xffn);
    bytes[3] = Number((now >> 16n) & 0xffn);
    bytes[4] = Number((now >> 8n) & 0xffn);
    bytes[5] = Number(now & 0xffn);

    // Version 7 (0111xxxx)
    bytes[6] = (bytes[6]! & 0x0f) | 0x70;
    // Variant 10xxxxxx
    bytes[8] = (bytes[8]! & 0x3f) | 0x80;

    let hex = '';
    for (let i = 0; i < 16; i++) {
        hex += bytes[i]!.toString(16).padStart(2, '0');
    }

    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
