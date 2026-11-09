import { setTimeout as sleep } from "node:timers/promises";
import { TOTAL_PAGES, validatePage } from "./mock";
import { Store } from "./store";

export class Importer {
  private busy = false;
  private stopped = false;
  private controller = new AbortController();
  constructor(
    private store: Store,
    private origin: string,
    private notify: (complete: boolean) => void,
  ) {}
  stop() {
    this.stopped = true;
    this.controller.abort();
  }
  async wake() {
    if (this.busy || this.stopped) return;
    const job = this.store.active();
    if (!job) return;
    this.busy = true;
    try {
      for (let page = job.nextPage; page < TOTAL_PAGES; page++) {
        const url = `${this.origin}/getTrades?batch=${job.batch}&page=${page}&delayMs=${job.delayMs}`;
        let payload: unknown;
        for (let attempt = 0; ; attempt++) {
          try {
            const response = await fetch(url, {
              signal: AbortSignal.any([
                this.controller.signal,
                AbortSignal.timeout(25000),
              ]),
            });
            if (!response.ok)
              throw new Error(`Upstream returned HTTP ${response.status}.`);
            payload = await response.json();
            break;
          } catch (error) {
            if (this.stopped || attempt === 2) throw error;
            await sleep(250 * 2 ** attempt, undefined, {
              signal: this.controller.signal,
            });
          }
        }
        this.store.stage(job.id, page, validatePage(payload, job.batch, page));
        this.notify(false);
      }
      this.store.complete(job.id);
      this.notify(true);
    } catch (error) {
      if (!this.stopped) {
        console.error("Import failed:", error);
        this.store.fail(
          job.id,
          error instanceof Error
            ? error.message
            : "The import failed. Try another pull.",
        );
        this.notify(false);
      }
    } finally {
      this.busy = false;
    }
  }
}
