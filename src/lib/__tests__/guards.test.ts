import { describe, test, expect } from "bun:test";
import { isString } from "../guards.js";

describe("isString", () => {
    test("should return true for a normal string", () => {
        expect(isString("hello")).toBe(true);
    });

    test("should return true for an empty string", () => {
        expect(isString("")).toBe(true);
    });

    test("should return false for a number", () => {
        expect(isString(123)).toBe(false);
    });

    test("should return false for a boolean", () => {
        expect(isString(true)).toBe(false);
        expect(isString(false)).toBe(false);
    });

    test("should return false for an object", () => {
        expect(isString({})).toBe(false);
        expect(isString({ foo: "bar" })).toBe(false);
    });

    test("should return false for an array", () => {
        expect(isString([])).toBe(false);
        expect(isString(["a", "b"])).toBe(false);
    });

    test("should return false for null", () => {
        expect(isString(null)).toBe(false);
    });

    test("should return false for undefined", () => {
        expect(isString(undefined)).toBe(false);
    });

    test("should return false for a function", () => {
        expect(isString(() => {})).toBe(false);
    });

    test("should return false for a Symbol", () => {
        expect(isString(Symbol("test"))).toBe(false);
    });
});
