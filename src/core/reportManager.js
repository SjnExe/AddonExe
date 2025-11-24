import * as mc from '@minecraft/server';
import { debugLog } from './logger.js';
import { errorLog } from './logger.js';
import { getConfig } from './configManager.js';

const reportsDbKey = 'exe:reports';

/**
 * @typedef {object} Report
 * @property {string} id - A unique ID for the report.
 * @property {string} reporterId - The ID of the player who made the report.
 * @property {string} reporterName - The name of the player who made the report.
 * @property {string} reportedPlayerId - The ID of the player who was reported.
 * @property {string} reportedPlayerName - The name of the player who was reported.
 * @property {string} reason - The reason for the report.
 * @property {string} status - The status of the report ('open', 'assigned', 'resolved').
 * @property {string|null} assignedAdminId - The ID of the admin assigned to the report.
 * @property {number} timestamp - The timestamp when the report was created.
 */

/** @type {Report[]} */
let reports = [];
let needsSave = false;

/**
 * Loads reports from world dynamic properties.
 */
export function loadReports() {
    debugLog('[ReportManager] Loading reports...');
    const dataStr = mc.world.getDynamicProperty(reportsDbKey);
    if (dataStr) {
        try {
            reports = JSON.parse(dataStr);
            debugLog(`[ReportManager] Loaded ${reports.length} reports.`);
        } catch (e) {
            errorLog('[ReportManager] Failed to parse report data from world property.', e);
            reports = [];
        }
    }
}

/**
 * Saves reports to world dynamic properties.
 * @param {object} [options={}]
 * @param {boolean} [options.force=false] - If true, saves even if the `needsSave` flag is false.
 */
export function saveReports(options = {}) {
    const { force = false } = options;
    if (!needsSave && !force) {return;}

    try {
        mc.world.setDynamicProperty(reportsDbKey, JSON.stringify(reports));
        needsSave = false; // Reset flag after saving
        debugLog('[ReportManager] Saved reports to world properties.');
    } catch (e) {
        errorLog('[ReportManager] Failed to save reports.', e);
    }
}

/**
 * Creates a new report and adds it to the list.
 * @param {import('@minecraft/server').Player} reporter The player making the report.
 * @param {string} reportedPlayerId The ID of the player being reported.
 * @param {string} reportedPlayerName The name of the player being reported.
 * @param {string} reason The reason for the report.
 */
export function createReport(reporter, reportedPlayerId, reportedPlayerName, reason) {
    const report = {
        id: Math.random().toString(36).substring(2, 9),
        reporterId: reporter.id,
        reporterName: reporter.name,
        reportedPlayerId: reportedPlayerId,
        reportedPlayerName: reportedPlayerName,
        reason: reason,
        status: 'open',
        assignedAdminId: null,
        timestamp: Date.now()
    };
    reports.push(report);
    needsSave = true;
    saveReports({ force: true }); // Save immediately
}

/**
 * Gets all active reports.
 * @returns {Report[]} A copy of the reports array.
 */
export function getAllReports() {
    return [...reports];
}

/**
 * Assigns a report to an admin.
 * @param {string} reportId The ID of the report to assign.
 * @param {string} adminId The ID of the admin to assign the report to.
 */
export function assignReport(reportId, adminId) {
    const report = reports.find(r => r.id === reportId);
    if (report) {
        report.status = 'assigned';
        report.assignedAdminId = adminId;
        needsSave = true;
        saveReports({ force: true });
    }
}

/**
 * Marks a report as resolved.
 * @param {string} reportId The ID of the report to resolve.
 */
export function resolveReport(reportId) {
    const report = reports.find(r => r.id === reportId);
    if (report) {
        report.status = 'resolved';
        needsSave = true;
        saveReports({ force: true });
    }
}

/**
 * Clears a report from the list.
 * @param {string} reportId The ID of the report to clear.
 */
export function clearReport(reportId) {
    const index = reports.findIndex(r => r.id === reportId);
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
    const lifetimeDays = config.reports?.resolvedReportLifetimeDays;

    if (typeof lifetimeDays !== 'number' || lifetimeDays <= 0) {
        return; // Feature is disabled or misconfigured
    }

    const lifetimeMs = lifetimeDays * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const originalCount = reports.length;

    reports = reports.filter(report => {
        if (report.status === 'resolved') {
            return (now - report.timestamp) < lifetimeMs;
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
}, 36000); // Clean up every 30 minutes
