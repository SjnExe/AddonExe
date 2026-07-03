let reportCounter = 0;
export function generateReportId(): string {
    reportCounter = (reportCounter + 1) % 1000000;
    const timePart = Date.now().toString(36);
    const randPart = Math.random().toString(36).substring(2, 8);
    return `rep-${timePart}-${reportCounter.toString(36)}-${randPart}`;
}
