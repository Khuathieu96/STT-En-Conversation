const DEFAULT_MODEL = "mistralai/mistral-7b-instruct:free";
const FALLBACK_MODELS = [
  "mistralai/mistral-7b-instruct:free",
  "meta-llama/llama-3.1-8b-instruct:free",
  "google/gemma-2-9b-it:free",
];

let cachedFreeModels: string[] | null = null;
let cachedFreeModelsAt = 0;
const FREE_MODEL_CACHE_TTL_MS = 300_000;
const EMPTY_FREE_MODEL_CACHE_TTL_MS = 15_000;
const UNAVAILABLE_MODEL_TTL_MS = 120_000;
const temporarilyUnavailableModels = new Map<string, number>();

type OpenRouterErrorBody = {
  error?: {
    message?: string;
    code?: number;
  };
};

type OpenRouterModelsBody = {
  data?: Array<{
    id?: string;
    pricing?: {
      prompt?: string;
      completion?: string;
    };
  }>;
};

function getConfiguredModel(): string {
  return String(import.meta.env.VITE_OPENROUTER_MODEL ?? "").trim();
}

function isBalanceExhaustedMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes("balance exhausted") || normalized.includes("insufficient") || normalized.includes("add funds");
}

function isTemporarilyUnavailable(model: string): boolean {
  const blockedUntil = temporarilyUnavailableModels.get(model) ?? 0;
  return blockedUntil > Date.now();
}

function markTemporarilyUnavailable(model: string) {
  temporarilyUnavailableModels.set(model, Date.now() + UNAVAILABLE_MODEL_TTL_MS);
}

async function requestCompletion(apiKey: string, prompt: string, model: string) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
    }),
  });

  const bodyText = await response.text();
  let bodyJson: OpenRouterErrorBody | null = null;
  try {
    bodyJson = JSON.parse(bodyText) as OpenRouterErrorBody;
  } catch {
    bodyJson = null;
  }

  return { response, bodyText, bodyJson };
}

async function getAvailableFreeModels(apiKey: string): Promise<string[]> {
  if (cachedFreeModels) {
    const age = Date.now() - cachedFreeModelsAt;
    const ttl = cachedFreeModels.length > 0 ? FREE_MODEL_CACHE_TTL_MS : EMPTY_FREE_MODEL_CACHE_TTL_MS;
    if (age < ttl) {
      return cachedFreeModels;
    }
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/models", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      cachedFreeModels = [];
      cachedFreeModelsAt = Date.now();
      return cachedFreeModels;
    }

    const body = (await response.json()) as OpenRouterModelsBody;
    const freeModels = (body.data ?? [])
      .filter((m) => {
        const id = m.id ?? "";
        if (id.includes(":free")) return true;
        return m.pricing?.prompt === "0" && m.pricing?.completion === "0";
      })
      .map((m) => m.id ?? "")
      .filter((id) => id.length > 0);

    cachedFreeModels = freeModels;
    cachedFreeModelsAt = Date.now();
    return cachedFreeModels;
  } catch {
    cachedFreeModels = [];
    cachedFreeModelsAt = Date.now();
    return cachedFreeModels;
  }
}

export async function callOpenRouter(apiKey: string, prompt: string): Promise<string> {
  if (!apiKey.trim()) {
    throw new Error("API key is required.");
  }

  const configuredModel = getConfiguredModel();
  const runtimeFreeModels = await getAvailableFreeModels(apiKey);
  const primaryModel = configuredModel || runtimeFreeModels[0] || DEFAULT_MODEL;
  const modelAttempts = Array.from(
    new Set([primaryModel, ...runtimeFreeModels, ...FALLBACK_MODELS]),
  ).filter((m) => m.length > 0 && !isTemporarilyUnavailable(m));

  // If everything was filtered out as temporarily unavailable, retry the full set.
  const effectiveAttempts = modelAttempts.length
    ? modelAttempts
    : Array.from(new Set([primaryModel, ...runtimeFreeModels, ...FALLBACK_MODELS])).filter((m) => m.length > 0);
  let lastError: Error | null = null;

  for (const model of effectiveAttempts) {
    const { response, bodyText, bodyJson } = await requestCompletion(apiKey, prompt, model);

    if (response.ok) {
      const data = bodyJson ?? JSON.parse(bodyText);
      const content = data?.choices?.[0]?.message?.content;
      if (typeof content !== "string") {
        throw new Error("Unexpected response format from OpenRouter.");
      }
      return content;
    }

    const modelErrorMessage = bodyJson?.error?.message ?? "";
    const noEndpoint = response.status === 404 && modelErrorMessage.includes("No endpoints found");

    if (isBalanceExhaustedMessage(modelErrorMessage) || isBalanceExhaustedMessage(bodyText)) {
      throw new Error("OpenRouter credits are exhausted. Please add funds or enable autopay in your OpenRouter organization settings.");
    }

    if (response.status === 401) {
      throw new Error("Invalid API key. Please check and try again.");
    }
    if (response.status === 429) {
      throw new Error("Rate limit reached. Please wait a moment and try again.");
    }

    if (!noEndpoint) {
      throw new Error(`OpenRouter error (${response.status}): ${bodyText.slice(0, 220)}`);
    }

    markTemporarilyUnavailable(model);

    lastError = new Error(`Model unavailable: ${model}. ${modelErrorMessage || "No endpoint found."}`);
  }

  throw new Error(
    `No usable OpenRouter model endpoint found. Last error: ${lastError?.message ?? "Unknown model error"}. ` +
    "Set VITE_OPENROUTER_MODEL to a currently available model from OpenRouter model list.",
  );
}
