/**
 * Represents a successful result.
 */
export type Success<T> = {
    success: true;
    data: T;
};

/**
 * Represents a failed result.
 */
export type Failure<E = Error> = {
    success: false;
    error: E;
};

/**
 * A Result type that can be either a Success or a Failure.
 */
export type Result<T, E = Error> = Success<T> | Failure<E>;

/**
 * Creates a success result.
 */
export function ok<T>(data: T): Success<T> {
    return { success: true, data };
}

/**
 * Creates a failure result.
 */
export function err<E = Error>(error: E): Failure<E> {
    return { success: false, error };
}

/**
 * Unwraps a Result, throwing the error if it failed.
 */
export function unwrap<T, E>(result: Result<T, E>): T {
    if (result.success) {
        return result.data;
    }
    if (result.error instanceof Error) {
        throw result.error;
    }
    throw new Error(String(result.error));
}
