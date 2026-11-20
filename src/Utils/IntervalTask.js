export class IntervalTask {
    constructor({ Name, IntervalMs, Task, Logger }) {
        this.Name = Name;
        this.IntervalMs = IntervalMs;
        this.Task = Task;
        this.Logger = Logger;
        this.Timer = null;
        this.IsStarted = false;
        this.CurrentRun = null;
        this.RunRequested = false;
    }

    Start({ RunImmediately = true } = {}) {
        if (this.IsStarted) {
            return;
        }
        this.IsStarted = true;
        this.ScheduleNextRun(RunImmediately ? 0 : this.IntervalMs);
    }

    Trigger() {
        if (!this.IsStarted) {
            return;
        }
        if (this.CurrentRun) {
            this.RunRequested = true;
            return;
        }
        this.ScheduleNextRun(0);
    }

    async Stop() {
        this.IsStarted = false;
        if (this.Timer) {
            clearTimeout(this.Timer);
            this.Timer = null;
        }
        if (this.CurrentRun) {
            await this.CurrentRun;
        }
    }

    ScheduleNextRun(DelayMs) {
        if (!this.IsStarted) {
            return;
        }
        if (this.Timer) {
            clearTimeout(this.Timer);
        }
        this.Timer = setTimeout(() => this.RunOnce(), DelayMs);
        this.Timer.unref?.();
    }

    async RunOnce() {
        this.Timer = null;
        this.RunRequested = false;
        this.CurrentRun = (async () => {
            try {
                await this.Task();
            } catch (TaskError) {
                this.Logger?.Error(`Background task "${this.Name}" failed`, { Error: TaskError });
            }
        })();
        await this.CurrentRun;
        this.CurrentRun = null;
        this.ScheduleNextRun(this.RunRequested ? 0 : this.IntervalMs);
    }
}
