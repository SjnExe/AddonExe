import { sentry } from '@minecraft/diagnostics';

import { debugLog, errorLog } from './logger.js';

const SENTRY_DSN = 'https://b01cca564a5da9e1ee6c37a9f1afffc5@o4510506629595136.ingest.de.sentry.io/4510506691592272';

export function initializeDiagnostics() {
    try {
        sentry.init({
            dsn: SENTRY_DSN,
            debug: false,
            sampleRate: 1.0
        });
        debugLog('[Diagnostics] Sentry initialized.');
    } catch (e) {
        // Log explicitly if it fails, but don't crash the addon
        errorLog(`[Diagnostics] Failed to initialize Sentry: ${String(e)}`);
    }
}
