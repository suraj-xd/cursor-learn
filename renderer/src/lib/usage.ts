import type { LanguageModelUsage } from "ai";

export type UsageData = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};

export type AppUsage = LanguageModelUsage & UsageData & { modelId?: string };

