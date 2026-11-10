/**
 * Provider-agnostic LLM layer. Anything that speaks the OpenAI Chat Completions wire format
 * works (OpenAI, xAI, Groq, OpenRouter, Together, Ollama, vLLM, LiteLLM…): set
 * OPENAI_BASE_URL + LLM_MODEL. Tests inject a fake provider.
 */
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMProvider {
  readonly name: string;
  /** Returns the raw model text, expected to be a JSON object. */
  completeJSON(messages: ChatMessage[], opts?: { temperature?: number; maxTokens?: number }): Promise<string>;
}

export class OpenAICompatibleProvider implements LLMProvider {
  readonly name: string;
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string,
    private readonly model: string,
    private readonly fetchImpl: typeof fetch = (...a) => fetch(...a),
    private readonly timeoutMs = 45_000,
  ) {
    this.name = `${model} @ ${safeHost(baseUrl)}`;
  }

  async completeJSON(messages: ChatMessage[], opts: { temperature?: number; maxTokens?: number } = {}): Promise<string> {
    const body: Record<string, unknown> = {
      model: this.model,
      messages,
      temperature: opts.temperature ?? 0.1,
      max_tokens: opts.maxTokens ?? 2000,
      response_format: { type: "json_object" },
    };
    let res = await this.post(body);
    // Some OpenAI-compatible servers reject response_format; retry once without it.
    if (res.status === 400) {
      const text = await res.text();
      if (/response_format/i.test(text)) {
        delete body.response_format;
        res = await this.post(body);
      } else throw new Error(`LLM HTTP 400: ${text.slice(0, 300)}`);
    }
    if (!res.ok) throw new Error(`LLM HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error("LLM returned no content");
    return content;
  }

  private post(body: Record<string, unknown>) {
    return this.fetchImpl(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeoutMs),
      cache: "no-store",
    });
  }
}

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/** Extracts the first JSON object from model text (handles ```json fences). */
export function extractJSON(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("No JSON object in LLM output");
  return JSON.parse(candidate.slice(start, end + 1));
}
