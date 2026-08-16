import { describe, expect, it, vi } from "vitest";
import { processBatch } from "../run";

describe("processBatch (offset advancement / no message loss)", () => {
  const u = (update_id: number) => ({ update_id });

  it("advances past every update when all succeed", async () => {
    const ingest = vi.fn().mockResolvedValue(true);
    const result = await processBatch([u(5), u(6), u(7)], ingest, 5);
    expect(result).toEqual({ offset: 8, stoppedOnFailure: false });
    expect(ingest).toHaveBeenCalledTimes(3);
  });

  it("stops WITHOUT advancing past the first failed update (no message loss)", async () => {
    // 5 succeeds, 6 fails -> offset must land on 6 (one past 5), NOT 7, so the
    // next poll re-fetches update 6. Update 7 must not be consumed.
    const ingest = vi
      .fn()
      .mockResolvedValueOnce(true) // 5
      .mockResolvedValueOnce(false); // 6 fails
    const result = await processBatch([u(5), u(6), u(7)], ingest, 5);
    expect(result).toEqual({ offset: 6, stoppedOnFailure: true });
    expect(ingest).toHaveBeenCalledTimes(2); // never reached 7
  });

  it("does not advance at all when the first update fails", async () => {
    const ingest = vi.fn().mockResolvedValue(false);
    const result = await processBatch([u(5), u(6)], ingest, 5);
    expect(result).toEqual({ offset: 5, stoppedOnFailure: true });
    expect(ingest).toHaveBeenCalledTimes(1);
  });

  it("returns the start offset unchanged for an empty batch", async () => {
    const ingest = vi.fn();
    const result = await processBatch([], ingest, 42);
    expect(result).toEqual({ offset: 42, stoppedOnFailure: false });
    expect(ingest).not.toHaveBeenCalled();
  });
});
