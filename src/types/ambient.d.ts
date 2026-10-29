declare const __CANARY__: boolean;
declare const __VERSION__: string;

interface Console {
  log(...data: unknown[]): void;
  error(...data: unknown[]): void;
  warn(...data: unknown[]): void;
  info(...data: unknown[]): void;
  debug(...data: unknown[]): void;
}

declare let console: Console;

declare module 'virtual:command-index' {
  export function loadCommands(): void | Promise<void>;
}
