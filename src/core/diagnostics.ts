import { sentry, SentryEventLevel } from '@minecraft/diagnostics';
import * as mc from '@minecraft/server';

import type { config as Config } from '../config.default.js';
import {
    debugLog,
    errorLog,
    getLogLevel,
    LogLevels,
    setExternalDebugHandler,
    setExternalErrorHandler,
    setExternalInfoHandler,
    setExternalWarnHandler,
    setLogLevel
} from './logger.js';

const SENTRY_DSN = 'https://b01cca564a5da9e1ee6c37a9f1afffc5@o4510506629595136.ingest.de.sentry.io/4510506691592272';
const DEBUG_EXPIRY_PROP = 'exe:sentryDebugExpiry';
const ORIGINAL_LOG_LEVEL_PROP = 'exe:sentryOriginalLogLevel';

let isSentryDebugMode = false;
let debugTimeout: number | undefined;

export function addSentryBreadcrumb(
    message: string,
    category: string = 'default',
    level: 'info' | 'error' | 'debug' | 'warning' | 'fatal' = 'info'
) {
    try {
        let sentryLevel = SentryEventLevel.info;
        switch (level) {
            case 'error': {
                sentryLevel = SentryEventLevel.error;
                break;
            }
            case 'debug': {
                sentryLevel = SentryEventLevel.debug;
                break;
            }
            case 'warning': {
                sentryLevel = SentryEventLevel.warning;
                break;
            }
            case 'fatal': {
                sentryLevel = SentryEventLevel.fatal;
                break;
            }
            case 'info': {
                sentryLevel = SentryEventLevel.info;
                break;
            }
            default: {
                sentryLevel = SentryEventLevel.info;
                break;
            }
        }
        sentry.addBreadcrumb(sentryLevel, message, category);
    } catch {
        // Ignore errors when adding breadcrumbs (e.g. if Sentry not initialized)
    }
}

export function setSentryDebug(enabled: boolean, minutes: number = 5) {
    if (enabled) {
        isSentryDebugMode = true;
        const expiry = Date.now() + minutes * 60 * 1000;
        mc.world.setDynamicProperty(DEBUG_EXPIRY_PROP, expiry);

        // Check if we need to upgrade log level
        const currentLevel = getLogLevel();
        if (currentLevel < LogLevels.DEBUG) {
            mc.world.setDynamicProperty(ORIGINAL_LOG_LEVEL_PROP, currentLevel);
            setLogLevel(LogLevels.DEBUG);
            debugLog('[Diagnostics] Log level temporarily raised to DEBUG for Sentry debugging.');
        } else {
            // Already debug or higher, don't mess with it, but clear any old restore point
            mc.world.setDynamicProperty(ORIGINAL_LOG_LEVEL_PROP, undefined);
        }

        // Schedule disable
        if (debugTimeout) mc.system.clearRun(debugTimeout);
        debugTimeout = mc.system.runTimeout(
            () => {
                setSentryDebug(false);
            },
            minutes * 60 * 20
        );

        debugLog(`[Diagnostics] Sentry debug mode ENABLED for ${minutes} minutes.`);
    } else {
        isSentryDebugMode = false;
        mc.world.setDynamicProperty(DEBUG_EXPIRY_PROP, undefined);

        // Restore log level if we changed it
        const originalLevel = mc.world.getDynamicProperty(ORIGINAL_LOG_LEVEL_PROP);
        if (typeof originalLevel === 'number') {
            setLogLevel(originalLevel);
            mc.world.setDynamicProperty(ORIGINAL_LOG_LEVEL_PROP, undefined);
            debugLog('[Diagnostics] Log level restored.');
        }

        if (debugTimeout) {
            mc.system.clearRun(debugTimeout);
            debugTimeout = undefined;
        }
        debugLog('[Diagnostics] Sentry debug mode DISABLED.');
    }
}

function restoreDebugState() {
    const expiry = mc.world.getDynamicProperty(DEBUG_EXPIRY_PROP) as number | undefined;
    if (expiry && expiry > Date.now()) {
        const remainingMs = expiry - Date.now();
        const remainingTicks = Math.ceil((remainingMs / 1000) * 20);

        isSentryDebugMode = true;

        // Ensure log level is still DEBUG if we expect it to be
        const originalLevel = mc.world.getDynamicProperty(ORIGINAL_LOG_LEVEL_PROP);
        if (typeof originalLevel === 'number' && getLogLevel() < LogLevels.DEBUG) {
            setLogLevel(LogLevels.DEBUG);
        }

        debugTimeout = mc.system.runTimeout(() => {
            setSentryDebug(false);
        }, remainingTicks);

        debugLog(`[Diagnostics] Restored Sentry debug mode. Expires in ${(remainingMs / 60_000).toFixed(1)} mins.`);
    } else if (expiry) {
        // Expired while offline
        setSentryDebug(false);
    }
}

export function configureDiagnostics(config: typeof Config) {
    try {
        if (config.version) {
            sentry.addTag('release', config.version.join('.'));
        }
        sentry.addTag('environment', config.isNightly ? 'nightly' : 'production');
    } catch {
        // Ignore errors during configuration
    }
}

export function initializeDiagnostics() {
    try {
        restoreDebugState();
        sentry.init({
            dsn: SENTRY_DSN,
            debug: false,
            sampleRate: 1,
            maxBreadcrumbs: 50
        });

        // Hook logger to Sentry to capture critical errors
        setExternalErrorHandler((error) => {
            sentry.captureException(error);
        });

        // Hook logger to Sentry for info logs (as breadcrumbs)
        setExternalInfoHandler((message) => {
            addSentryBreadcrumb(message, 'logger', 'info');
        });

        // Hook logger to Sentry for warn logs (as breadcrumbs)
        setExternalWarnHandler((message) => {
            addSentryBreadcrumb(message, 'logger', 'warning');
        });

        // Hook logger to Sentry for debug logs (when enabled)
        setExternalDebugHandler((message) => {
            if (isSentryDebugMode) {
                // Send debug log as an event/exception to ensure it reaches Sentry immediately
                const debugError = new Error(`[DEBUG_MODE] ${message}`);
                sentry.captureException(debugError);
            }
        });

        debugLog('[Diagnostics] Sentry initialized.');
    } catch (error) {
        // Log explicitly if it fails, but don't crash the addon
        errorLog(`[Diagnostics] Failed to initialize Sentry: ${String(error)}`);
    }
}
