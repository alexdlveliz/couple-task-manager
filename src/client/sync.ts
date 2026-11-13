import type { BoardSnapshot, Partner } from "../shared/contracts";

interface Options {
  uid: string;
  load: (revision?: number) => Promise<BoardSnapshot | null>;
  partners: () => Promise<Partner[]>;
  accept: (board: BoardSnapshot, partners: Partner[]) => void;
  refreshing?: () => void;
  verified?: () => void;
  error?: (error: unknown) => void;
}
export class RefreshCoordinator {
  private snapshot?: BoardSnapshot;
  private partnerList: Partner[] = [];
  private highestSeen = -1;
  private pending = false;
  private inflight?: Promise<void>;
  private stopped = false;
  private timer?: ReturnType<typeof setInterval>;
  constructor(private options: Options) {}
  restore(board: BoardSnapshot, partners: Partner[]): void {
    if (this.stopped || this.snapshot || this.inflight) return;
    this.snapshot = board;
    this.partnerList = partners;
    this.highestSeen = Math.max(this.highestSeen, board.revision);
  }
  start(): void {
    this.timer = setInterval(() => {
      if (document.visibilityState === "visible" && navigator.onLine)
        void this.refresh();
    }, 15_000);
    window.addEventListener("focus", this.onFocus);
    window.addEventListener("online", this.onFocus);
    document.addEventListener("visibilitychange", this.onVisibility);
  }
  private onFocus = () => {
    if (
      !this.stopped &&
      navigator.onLine &&
      document.visibilityState === "visible"
    )
      void this.refresh();
  };
  private onVisibility = () => {
    if (document.visibilityState === "visible") this.onFocus();
  };
  saved(revision: number): void {
    this.highestSeen = Math.max(this.highestSeen, revision);
    void this.refresh();
  }
  refresh(): Promise<void> {
    if (this.stopped) return Promise.resolve();
    if (this.inflight) {
      this.pending = true;
      return this.inflight;
    }
    this.inflight = this.run().finally(() => {
      this.inflight = undefined;
    });
    return this.inflight;
  }
  private async run(): Promise<void> {
    let staleRetries = 0;
    const retryStale = () => {
      if (++staleRetries > 1) throw new Error("Stale board response");
      this.pending = true;
    };
    do {
      this.pending = false;
      const requestedRevision = this.snapshot?.revision;
      try {
        this.options.refreshing?.();
        const board = await this.options.load(requestedRevision);
        if (this.stopped) return;
        if (!board) {
          if (
            requestedRevision === undefined ||
            requestedRevision < this.highestSeen ||
            this.snapshot?.revision !== requestedRevision
          ) {
            retryStale();
            continue;
          }
          staleRetries = 0;
          this.options.verified?.();
        } else if (
          board.revision < this.highestSeen ||
          (this.snapshot && board.revision < this.snapshot.revision)
        ) {
          retryStale();
        } else {
          const partners = await this.options.partners();
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Async cleanup or external input can invalidate static assumptions.
          if (this.stopped) return;
          if (board.revision < this.highestSeen) {
            retryStale();
            continue;
          }
          staleRetries = 0;
          this.snapshot = board;
          this.partnerList = partners;
          this.highestSeen = board.revision;
          this.options.accept(board, this.partnerList);
          this.options.verified?.();
        }
      } catch (error) {
        if (!this.stopped) this.options.error?.(error);
      }
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Async cleanup or external input can invalidate static assumptions.
    } while (this.pending && !this.stopped);
  }
  stop(): void {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    if (typeof window !== "undefined") {
      window.removeEventListener("focus", this.onFocus);
      window.removeEventListener("online", this.onFocus);
      document.removeEventListener("visibilitychange", this.onVisibility);
    }
  }
}
