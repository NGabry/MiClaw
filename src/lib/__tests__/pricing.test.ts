import { describe, it, expect } from "vitest";
import { estimateCostUSD } from "../pricing";

describe("estimateCostUSD", () => {
  it("uses Opus pricing for opus model strings", () => {
    // 1M input tokens at $15/MTok = $15
    const cost = estimateCostUSD(1_000_000, 0, 0, 0, "claude-opus-4-6");
    expect(cost).toBeCloseTo(15, 2);
  });

  it("uses Sonnet pricing for sonnet model strings", () => {
    // 1M input tokens at $3/MTok = $3
    const cost = estimateCostUSD(1_000_000, 0, 0, 0, "claude-sonnet-4-6");
    expect(cost).toBeCloseTo(3, 2);
  });

  it("uses Haiku pricing for haiku model strings", () => {
    // 1M input tokens at $0.80/MTok = $0.80
    const cost = estimateCostUSD(1_000_000, 0, 0, 0, "claude-haiku-4-5-20251001");
    expect(cost).toBeCloseTo(0.8, 2);
  });

  it("defaults to Opus pricing when no model provided", () => {
    const cost = estimateCostUSD(1_000_000, 0, 0, 0);
    expect(cost).toBeCloseTo(15, 2);
  });

  it("defaults to Opus pricing for unknown model strings", () => {
    const cost = estimateCostUSD(1_000_000, 0, 0, 0, "claude-unknown-99");
    expect(cost).toBeCloseTo(15, 2);
  });

  it("computes Opus output cost correctly", () => {
    // 1M output tokens at $75/MTok = $75
    const cost = estimateCostUSD(0, 0, 0, 1_000_000, "claude-opus-4-6");
    expect(cost).toBeCloseTo(75, 2);
  });

  it("computes Opus cache read cost correctly", () => {
    // 1M cache read tokens at $1.50/MTok = $1.50
    const cost = estimateCostUSD(0, 1_000_000, 0, 0, "claude-opus-4-6");
    expect(cost).toBeCloseTo(1.5, 2);
  });

  it("computes Opus cache write cost correctly", () => {
    // 1M cache create tokens at $18.75/MTok = $18.75
    const cost = estimateCostUSD(0, 0, 1_000_000, 0, "claude-opus-4-6");
    expect(cost).toBeCloseTo(18.75, 2);
  });

  it("sums all token types for a realistic session", () => {
    // Typical Opus session:
    // 50k input, 200k cache read, 30k cache write, 10k output
    const cost = estimateCostUSD(50_000, 200_000, 30_000, 10_000, "claude-opus-4-6");
    // (50k*15 + 200k*1.5 + 30k*18.75 + 10k*75) / 1M
    // = (750000 + 300000 + 562500 + 750000) / 1000000
    // = 2362500 / 1000000 = 2.3625
    expect(cost).toBeCloseTo(2.3625, 4);
  });

  it("returns 0 for zero tokens", () => {
    expect(estimateCostUSD(0, 0, 0, 0, "claude-opus-4-6")).toBe(0);
  });
});
