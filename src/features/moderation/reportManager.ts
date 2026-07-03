import * as mc from '@minecraft/server';

import { getConfig } from '@core/configManager.js';
import { debugLog, errorLog } from '@core/logger.js';
import { StorageManager } from '@core/storage/StorageManager.js';
import { isDefined } from '@lib/guards.js';

const storage = new StorageManager('exe:reports');

export interface Report {
    id: string;
    reporterId: string;
    reporterName: string;
    reportedPlayerId: string;
    reportedPlayerName: string;
    reason: string;
    status: 'open' | 'assigned' | 'resolved';
    assignedAdminId: string | undefined;
    timestamp: number;
}

let reports: Report[] = [];
let needsSave = false;

// We cannot use a true crypto UUID implementation like `uuidv4` because the QuickJS
// engine in Minecraft Bedrock lacks the Web Crypto API, which will cause a crash.
// Instead, we mitigate predictability by generating a high-entropy string using multiple Math.random() calls.
function generateReportId(): string {
    const timePart = Date.now().toString(36);
    const r1 = Math.random().toString(36).substring(2);
    const r2 = Math.random().toString(36).substring(2);
    const r3 = Math.random().toString(36).substring(2);
    const r4 = Math.random().toString(36).substring(2);
    return `${timePart}-${r1}${r2}${r3}${r4}`;
}

/**
 * Loads reports from world dynamic properties.
 */
export function loadReports() {
    debugLog('[ReportManager] Loading reports...');
    const loaded = storage.load<Report[]>();
    if (isDefined(loaded)) {
        reports = loaded;
        debugLog(`[ReportManager] Loaded ${reports.length} reports.`);
    }
}

/**
 * Saves reports to world dynamic properties.
 * @param options
 * @param options.force - If true, saves even if the `needsSave` flag is false.
 */
export function saveReports(options: { force?: boolean } = {}) {
    const { force = false } = options;
    if (!needsSave && !force) {
        return;
    }

    try {
        storage.save(reports);
        needsSave = false; // Reset flag after saving
        debugLog('[ReportManager] Saved reports to world properties.');
    } catch (error) {
        errorLog('[ReportManager] Failed to save reports.', error);
    }
}

/**
 * Creates a new report and adds it to the list.
 * @param reporter The player making the report.
 * @param reportedPlayerId The ID of the player being reported.
 * @param reportedPlayerName The name of the player being reported.
 * @param reason The reason for the report.
 */
export function createReport(reporter: mc.Player, reportedPlayerId: string, reportedPlayerName: string, reason: string) {
    const report: Report = {
        id: generateReportId(),
        reporterId: reporter.id,
        reporterName: reporter.name,
        reportedPlayerId: reportedPlayerId,
        reportedPlayerName: reportedPlayerName,
        reason: reason,
        status: 'open',
        assignedAdminId: undefined,
        timestamp: Date.now()
    };
    reports.push(report);
    needsSave = true;
    saveReports({ force: true }); // Save immediately
}

/**
 * Gets all active reports.
 * @returns A copy of the reports array.
 */
export function getAllReports(): Report[] {
    return [...reports];
}

/**
 * Assigns a report to an admin.
 * @param reportId The ID of the report to assign.
 * @param adminId The ID of the admin to assign the report to.
 */
export function assignReport(reportId: string, adminId: string) {
    const report = reports.find((r) => r.id === reportId);
    if (isDefined(report)) {
        report.status = 'assigned';
        report.assignedAdminId = adminId;
        needsSave = true;
        saveReports({ force: true });
    }
}

/**
 * Marks a report as resolved.
 * @param reportId The ID of the report to resolve.
 */
export function resolveReport(reportId: string) {
    const report = reports.find((r) => r.id === reportId);
    if (isDefined(report)) {
        report.status = 'resolved';
        needsSave = true;
        saveReports({ force: true });
    }
}

/**
 * Clears a report from the list.
 * @param reportId The ID of the report to clear.
 */
export function clearReport(reportId: string) {
    const index = reports.findIndex((r) => r.id === reportId);
    if (index !== -1) {
        reports.splice(index, 1);
        needsSave = true;
        saveReports({ force: true });
    }
}

/**
 * Clears all reports from the list.
 */
export function clearAllReports() {
    if (reports.length > 0) {
        reports.length = 0;
        needsSave = true;
        saveReports({ force: true });
    }
}

/**
 * Clears old, resolved reports from the system to prevent data bloat.
 */
export function clearOldResolvedReports() {
    const config = getConfig();
    const lifetimeDays = config.reports.resolvedReportLifetimeDays;

    if (typeof lifetimeDays !== 'number' || lifetimeDays <= 0) {
        return; // Feature is disabled or misconfigured
    }

    const lifetimeMs = lifetimeDays * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const originalCount = reports.length;

    reports = reports.filter((report) => {
        if (report.status === 'resolved') {
            return now - report.timestamp < lifetimeMs;
        }
        return true; // Keep all non-resolved reports
    });

    const clearedCount = originalCount - reports.length;
    if (clearedCount > 0) {
        needsSave = true;
        debugLog(`[ReportManager] Cleared ${clearedCount} old resolved reports.`);
    }
}

// Periodically clean up old reports. Saving is now handled by the central dataManager.
mc.system.runInterval(() => {
    clearOldResolvedReports();
}, 36_000); // Clean up every 30 minutes (36000 ticks)
