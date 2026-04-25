/**
 * Claude model pricing (USD per million tokens).
 *
 * Source: https://docs.anthropic.com/en/docs/about-claude/models
 * Last updated: 2025-05 (Claude 4.5/4.6 family)
 */

export interface ModelPricing {
  input: number;       // non-cached input $/MTok
  cacheRead: number;   // cache read $/MTok
  cacheCreate: number; // cache write $/MTok
  output: number;      // output $/MTok
}

const PRICING: Record<string, ModelPricing> = {
  opus: { input: 15, cacheRead: 1.50, cacheCreate: 18.75, output: 75 },
  sonnet: { input: 3, cacheRead: 0.30, cacheCreate: 3.75, output: 15 },
  haiku: { input: 0.80, cacheRead: 0.08, cacheCreate: 1.00, output: 4 },
};

// Default to Opus since it's the default Claude Code model
const DEFAULT_PRICING = PRICING.opus;

export function getPricing(model?: string): ModelPricing {
  if (!model) return DEFAULT_PRICING;
  const lower = model.toLowerCase();
  if (lower.includes("opus")) return PRICING.opus;
  if (lower.includes("sonnet")) return PRICING.sonnet;
  if (lower.includes("haiku")) return PRICING.haiku;
  return DEFAULT_PRICING;
}

export function estimateCostUSD(
  inputTokens: number,
  cacheReadTokens: number,
  cacheCreateTokens: number,
  outputTokens: number,
  model?: string,
): number {
  const p = getPricing(model);
  return (
    inputTokens * p.input +
    cacheReadTokens * p.cacheRead +
    cacheCreateTokens * p.cacheCreate +
    outputTokens * p.output
  ) / 1_000_000;
}
