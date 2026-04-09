import { vi } from "vitest";

// Mock crypto.randomUUID for deterministic tests
let uuidCounter = 0;
vi.stubGlobal("crypto", {
  ...globalThis.crypto,
  randomUUID: () => `test-uuid-${++uuidCounter}`,
});

// Reset counter between tests
beforeEach(() => {
  uuidCounter = 0;
});
