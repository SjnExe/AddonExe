import { Vector3Utils } from '@minecraft/math';
import * as mc from '@minecraft/server';

/**
 * High-Performance Vector and Spatial Math Suite.
 * This class wraps native `@minecraft/math` methods to offload heavy calculations
 * to the engine layer, minimizing script tick latency.
 */
export class MathUtils {
    /**
     * Calculates the horizontal distance (hypotenuse) between two 2D coordinates.
     */
    public static hypotenuse2D(x1: number, z1: number, x2: number = 0, z2: number = 0): number {
        // Technically still JS Math, but faster than manually doing the math
        // for cases where we don't have full Vector3s
        return Math.hypot(x1 - x2, z1 - z2);
    }

    /**
     * Calculates the exact 3D distance between two Vector3 points.
     * Offloads to native engine.
     */
    public static distance(v1: mc.Vector3, v2: mc.Vector3): number {
        return Vector3Utils.distance(v1, v2);
    }

    /**
     * Clamps a value between a minimum and maximum.
     */
    public static clamp(value: number, min: number, max: number): number {
        return Math.max(min, Math.min(max, value));
    }

    /**
     * Rounds a number to a specific number of decimal places.
     */
    public static round(value: number, decimals: number = 2): number {
        const factor = 10 ** decimals;
        return Math.round(value * factor) / factor;
    }

    /**
     * Normalizes a Vector3 to a length of 1.
     * Offloads to native engine.
     */
    public static normalize(v: mc.Vector3): mc.Vector3 {
        return Vector3Utils.normalize(v);
    }

    /**
     * Adds two Vector3s together.
     * Offloads to native engine.
     */
    public static add(v1: mc.Vector3, v2: mc.Vector3): mc.Vector3 {
        return Vector3Utils.add(v1, v2);
    }

    /**
     * Subtracts v2 from v1.
     * Offloads to native engine.
     */
    public static subtract(v1: mc.Vector3, v2: mc.Vector3): mc.Vector3 {
        return Vector3Utils.subtract(v1, v2);
    }

    /**
     * Scales a Vector3 by a scalar value.
     * Offloads to native engine.
     */
    public static scale(v: mc.Vector3, scalar: number): mc.Vector3 {
        return Vector3Utils.scale(v, scalar);
    }
}
