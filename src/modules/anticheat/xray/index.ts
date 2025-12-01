import { initializeXrayDetection } from '../../detections/xrayDetection.js';

import { initializeBaitSystem } from './bait.js';
import { initializeHeuristics } from './heuristics.js';
import { initializeObfuscator } from './obfuscator.js';

export function initializeXray() {
    // Legacy notification system (still useful for basic alerts)
    initializeXrayDetection();

    // New Anti-Cheat systems
    initializeObfuscator();
    initializeHeuristics();
    initializeBaitSystem();
}
