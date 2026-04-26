import { STRICT_KOSHER_ALLERGY_SYSTEM_PROMPT } from "@/lib/ai/prompt";

export type ProviderMessage = {
  system: string;
  user: string;
};

export type ProviderResult = {
  rawText: string;
  provider: string;
};

type ChatChoiceResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

type AnthropicResponse = {
  content?: Array<{
    type?: string;
    text?: string;
  }>;
};

const DEFAULT_TIMEOUT_MS = 30_000;

function timeoutSignal() {
  const timeout = Number(process.env.AI_REQUEST_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
  return AbortSignal.timeout(Number.isFinite(timeout) ? timeout : DEFAULT_TIMEOUT_MS);
}

function getProvider() {
  const configured = process.env.LLM_PROVIDER?.toLowerCase();
  if (configured) return configured;
  return process.env.NODE_ENV === "production" ? "openai" : "mock";
}

function missingKey(provider: string, keyName: string): never {
  throw new Error(`${provider} is configured but ${keyName} is missing.`);
}

async function parseError(response: Response) {
  const body = await response.text().catch(() => "");
  return `Provider returned ${response.status}${body ? `: ${body.slice(0, 300)}` : ""}`;
}

async function callOpenAiCompatible(
  provider: "openai" | "grok",
  baseUrl: string,
  apiKey: string | undefined,
  model: string,
  message: ProviderMessage
): Promise<ProviderResult> {
  if (!apiKey) missingKey(provider, provider === "openai" ? "OPENAI_API_KEY" : "GROK_API_KEY");

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    signal: timeoutSignal(),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: message.system },
        { role: "user", content: message.user }
      ]
    })
  });

  if (!response.ok) throw new Error(await parseError(response));
  const data = (await response.json()) as ChatChoiceResponse;
  const rawText = data.choices?.[0]?.message?.content;
  if (!rawText) throw new Error(`${provider} returned no recipe content.`);
  return { rawText, provider };
}

async function callAnthropic(message: ProviderMessage): Promise<ProviderResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) missingKey("anthropic", "ANTHROPIC_API_KEY");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    signal: timeoutSignal(),
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL ?? "claude-3-5-sonnet-latest",
      max_tokens: 1800,
      temperature: 0.7,
      system: message.system,
      messages: [{ role: "user", content: message.user }]
    })
  });

  if (!response.ok) throw new Error(await parseError(response));
  const data = (await response.json()) as AnthropicResponse;
  const rawText = data.content?.find((item) => item.type === "text")?.text;
  if (!rawText) throw new Error("anthropic returned no recipe content.");
  return { rawText, provider: "anthropic" };
}

function callMock(): ProviderResult {
  return {
    provider: "mock",
    rawText: JSON.stringify({
      title: "Herbed Sweet Potato Quinoa Pilaf",
      kosherType: "parve",
      ingredients: [
        { name: "Quinoa (parve)", quantity: "1 1/2", unit: "cups" },
        { name: "Sweet potatoes, peeled and cubed (parve)", quantity: "2", unit: "medium" },
        { name: "Olive oil (parve)", quantity: "3", unit: "tablespoons" },
        { name: "Carrots, diced (parve)", quantity: "2", unit: "medium" },
        { name: "Celery, diced (parve)", quantity: "2", unit: "stalks" },
        { name: "Fresh parsley, chopped (parve)", quantity: "1/3", unit: "cup" },
        { name: "Lemon juice (parve)", quantity: "2", unit: "tablespoons" },
        { name: "Kosher salt (parve)", quantity: "1", unit: "teaspoon" },
        { name: "Black pepper-free herb blend (parve)", quantity: "1", unit: "teaspoon" }
      ],
      instructions: [
        "Rinse quinoa until the water runs clear, then cook it in 3 cups of water until fluffy.",
        "Roast sweet potatoes with olive oil and kosher salt at 400 F until tender and lightly browned.",
        "Saute carrots and celery in olive oil until softened but not browned.",
        "Fold quinoa, vegetables, parsley, lemon juice, and herb blend together.",
        "Taste, adjust salt, and serve warm or room temperature."
      ],
      prepTimeMinutes: 15,
      cookTimeMinutes: 30,
      servings: 4,
      notes: "Nightshade and tomato safe. Sweet potatoes are used instead of white potatoes."
    })
  };
}

export async function callRecipeProvider(userPrompt: string): Promise<ProviderResult> {
  const message = {
    system: STRICT_KOSHER_ALLERGY_SYSTEM_PROMPT,
    user: userPrompt
  };
  const provider = getProvider();

  if (provider === "mock") return callMock();
  if (provider === "openai") {
    return callOpenAiCompatible(
      "openai",
      "https://api.openai.com/v1",
      process.env.OPENAI_API_KEY,
      process.env.OPENAI_MODEL ?? "gpt-4o",
      message
    );
  }
  if (provider === "grok") {
    return callOpenAiCompatible(
      "grok",
      process.env.GROK_BASE_URL ?? "https://api.x.ai/v1",
      process.env.GROK_API_KEY,
      process.env.GROK_MODEL ?? "grok-2-latest",
      message
    );
  }
  if (provider === "anthropic") return callAnthropic(message);

  throw new Error(`Unsupported LLM_PROVIDER "${provider}".`);
}
