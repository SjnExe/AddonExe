let counter = 0;
export function generateSecureId(length: number = 16): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';

    // We cannot use crypto.randomUUID() because Minecraft bedrock server might not have it or it's restricted.
    // Instead we can use a combination of time and randomness.
    // But wait, the issue is "Insecure Randomness in Report ID Generation" and "Math.random() is used for generating report IDs. Predictable report IDs could allow users to guess or iterate through reports".
    // If Math.random() is insecure, can we use something else?
    // Is there a crypto module? Let's check node modules.
}
