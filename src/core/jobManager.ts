import * as mc from '@minecraft/server';

interface Job {
    id: string;
    priority: number; // Higher is more important
    work: () => void | Promise<void>;
}

class JobManager {
    private queue: Job[] = [];
    private maxMsPerTick = 5; // Default budget
    // private maxUpdatesPerTick = 100; // Default budget for block updates

    constructor() {
        mc.system.runInterval(() => {
            void this.processQueue();
        }, 1);
    }

    public addJob(job: Job) {
        this.queue.push(job);
        // Sort by priority (descending)
        this.queue.sort((a, b) => b.priority - a.priority);
    }

    private async processQueue() {
        const startTime = Date.now();
        // let updatesProcessed = 0; // Unused for now

        while (this.queue.length > 0) {
            // Check budgets
            if (Date.now() - startTime >= this.maxMsPerTick) break;
            // Note: maxUpdatesPerTick is a heuristic we'll rely on jobs to respect or self-report
            // For now, we mainly throttle by time.

            const job = this.queue.shift();
            if (job) {
                try {
                    await job.work();
                } catch (e) {
                    // eslint-disable-next-line no-console
                    console.warn(`[JobManager] Job ${job.id} failed:`, e);
                }
            }
        }
    }

    public setBudget(ms: number) {
        this.maxMsPerTick = ms;
    }
}

export const jobManager = new JobManager();
