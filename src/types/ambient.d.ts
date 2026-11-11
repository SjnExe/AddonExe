declare const __VERSION__: string;

interface Console {
  log(...data: unknown[]): void;
  error(...data: unknown[]): void;
  warn(...data: unknown[]): void;
  info(...data: unknown[]): void;
  debug(...data: unknown[]): void;
}

declare let console: Console;

declare module 'bun:bundle' {
  /**
   * Evaluates whether a compile-time feature flag is active in the current bundle.
   *
   * @param name The feature flag identifier (e.g. 'CANARY').
   * @returns `true` if the feature is enabled; otherwise `false`.
   */
  export function feature(name: string): boolean;
}
