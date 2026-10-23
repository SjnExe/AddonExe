declare const __ENVIRONMENT__: 'BDS' | 'REALMS' | undefined;
declare const __IS_NIGHTLY__: boolean | undefined;
declare const __VERSION__: string | undefined;

interface Console {
  log(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

declare const console: Console;

declare module 'virtual:command-index' {
  export function loadCommands(): void;
}

declare module 'virtual:icon-index' {
  export const usedIcons: string[];
}
