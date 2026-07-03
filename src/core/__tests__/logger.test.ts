import { afterAll, beforeAll, beforeEach, describe, expect, it, mock } from 'bun:test';
import { debugLog, errorLog, infoLog, LogLevels, setExternalDebugHandler, setExternalErrorHandler, setExternalInfoHandler, setExternalWarnHandler, setLogLevel, warnLog } from '../logger.js';

describe('Logger External Handlers', () => {
    let originalConsoleLog: any;
    let originalConsoleInfo: any;
    let originalConsoleWarn: any;
    let originalConsoleError: any;

    beforeAll(() => {
        originalConsoleLog = console.log;
        originalConsoleInfo = console.info;
        originalConsoleWarn = console.warn;
        originalConsoleError = console.error;
    });

    beforeEach(() => {
        // Mock console methods to keep test output clean
        console.log = mock();
        console.info = mock();
        console.warn = mock();
        console.error = mock();

        // Ensure log level allows all logs to be processed
        setLogLevel(LogLevels.DEBUG);
    });

    afterAll(() => {
        // Restore console
        console.log = originalConsoleLog;
        console.info = originalConsoleInfo;
        console.warn = originalConsoleWarn;
        console.error = originalConsoleError;
    });

    it('should register and call external debug handler', () => {
        const mockHandler = mock();
        setExternalDebugHandler(mockHandler);

        const testMessage = 'Test debug message';
        debugLog(testMessage);

        expect(mockHandler).toHaveBeenCalledTimes(1);
        expect(mockHandler).toHaveBeenCalledWith(testMessage);
    });

    it('should register and call external info handler', () => {
        const mockHandler = mock();
        setExternalInfoHandler(mockHandler);

        const testMessage = 'Test info message';
        infoLog(testMessage);

        expect(mockHandler).toHaveBeenCalledTimes(1);
        expect(mockHandler).toHaveBeenCalledWith(testMessage);
    });

    it('should register and call external warn handler', () => {
        const mockHandler = mock();
        setExternalWarnHandler(mockHandler);

        const testMessage = 'Test warn message';
        warnLog(testMessage);

        expect(mockHandler).toHaveBeenCalledTimes(1);
        expect(mockHandler).toHaveBeenCalledWith(testMessage);
    });

    describe('External error handler', () => {
        it('should register and call external error handler with explicit error object', () => {
            const mockHandler = mock();
            setExternalErrorHandler(mockHandler);

            const testMessage = 'Test error message';
            const testError = new Error('Explicit error');
            errorLog(testMessage, testError);

            expect(mockHandler).toHaveBeenCalledTimes(1);
            expect(mockHandler).toHaveBeenCalledWith(testError, testMessage);
        });

        it('should register and call external error handler with generated error when only message provided', () => {
            const mockHandler = mock();
            setExternalErrorHandler(mockHandler);

            const testMessage = 'Test error message only';
            errorLog(testMessage);

            expect(mockHandler).toHaveBeenCalledTimes(1);
            const callArgs = mockHandler.mock.calls[0];
            expect(callArgs[0]).toBeInstanceOf(Error);
            expect((callArgs[0] as Error).message).toBe(testMessage);
            expect(callArgs[1]).toBe(testMessage);
        });
    });
});
