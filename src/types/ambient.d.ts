declare const __IS_NIGHTLY__: boolean;
declare const __VERSION__: string;
declare const __DEV__: boolean;

interface Console {
  log(...data: unknown[]): void;
  error(...data: unknown[]): void;
  warn(...data: unknown[]): void;
  info(...data: unknown[]): void;
  debug(...data: unknown[]): void;
}

declare let console: Console;

declare module 'virtual:command-index' {
  export function loadCommands(): Promise<void>;
}
