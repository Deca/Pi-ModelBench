import { describe, expect, it } from "vitest";
import type { Api, Model } from "@earendil-works/pi-ai";
import { buildRequestOptions } from "../src/core/pi-runner.js";
import type { BenchmarkProfile } from "../src/core/types.js";

const settings: BenchmarkProfile["defaults"] = {
  runs: 1,
  temperature: 0,
  maxTokens: 100,
  reasoning: "low",
};

const model = (api: Api): Model<Api> => ({
  provider: api === "openai-codex-responses" ? "openai-codex" : "openai",
  id: "test-model",
  name: "Test model",
  api,
  baseUrl: "https://example.test",
  reasoning: true,
  input: ["text"],
  cost: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 1000,
  maxTokens: 100,
});

describe("buildRequestOptions", () => {
  it("omits unsupported temperature for Codex Responses", () => {
    const options = buildRequestOptions(model("openai-codex-responses"), settings, { apiKey: "test" });

    expect(options).not.toHaveProperty("temperature");
    expect(options.reasoning).toBe("low");
  });

  it("keeps temperature for providers that support it", () => {
    const options = buildRequestOptions(model("openai-responses"), settings, { apiKey: "test" });

    expect(options.temperature).toBe(0);
  });
});
