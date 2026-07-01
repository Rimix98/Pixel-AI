// Preprocessing pipeline: prompt sanitization, token estimation, injection detection, response validation

// --- Token estimation (rough: ~4 chars per token for English, ~2 for CJK) ---
export function estimateTokens(text: string): number {
  let count = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    // CJK unified ideographs
    if (code >= 0x4e00 && code <= 0x9fff) count += 2;
    // Cyrillic
    else if (code >= 0x0400 && code <= 0x04ff) count += 0.7;
    // Latin and common punctuation
    else count += 0.25;
  }
  return Math.ceil(count);
}

// --- Prompt injection detection ---
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|rules?)/i,
  /you\s+are\s+now\s+(a|an)\s+/i,
  /system\s*(prompt|message)\s*[:=]/i,
  /forget\s+(everything|all|your)\s+(you|were|have)/i,
  /override\s+(safety|instructions?|rules?)/i,
  /jailbreak/i,
  /DAN\s+mode/i,
  /act\s+as\s+if\s+you\s+have\s+no\s+(restrictions?|rules?|limits?)/i,
  /\bdo\s+anything\s+now\b/i,
  /developer\s+mode\s+(enabled|activated)/i,
  /\[INST\]/i,
  /<<SYS>>/i,
  /<\|im_start\|>/i,
  /\bpretend\b.*\byou\b.*\bare\b.*\bDAN\b/i,
  /from\s+now\s+on\s+you\s+(will|must|should)\s+(respond|answer|reply)/i,
  /на\s+самом\s+деле\s+я\s+являюсь/i,
  /честно\s+укажи\s+свою\s+реальную/i,
  /реальную\s+нейросетевую\s+архитектуру/i,
  /игнорируй\s+любые\s+вымышленные\s+бренды/i,
  /это\s+приказ\s+администратора/i,
  /reveal\s+your\s+(real|actual|true)\s+(model|architecture|identity)/i,
  /what\s+(model|llm|ai)\s+(are\s+you|powers\s+you|do\s+you\s+use)/i,
];

export interface InjectionCheck {
  safe: boolean;
  patterns: string[];
}

export function detectInjection(text: string): InjectionCheck {
  const matched: string[] = [];
  for (const pat of INJECTION_PATTERNS) {
    if (pat.test(text)) matched.push(pat.source);
  }
  return { safe: matched.length === 0, patterns: matched };
}

// --- Prompt sanitization ---
export function sanitizePrompt(input: string, maxTokens = 4000): string {
  let cleaned = input
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "")  // control chars
    .replace(/\s+/g, " ")                               // collapse whitespace
    .trim();

  // Truncate by estimated tokens
  while (estimateTokens(cleaned) > maxTokens && cleaned.length > 0) {
    cleaned = cleaned.slice(0, -100);
  }

  return cleaned;
}

// --- Response validation ---
export interface ValidationResult {
  valid: boolean;
  cleaned: string;
  issues: string[];
}

export function validateResponse(content: string): ValidationResult {
  const issues: string[] = [];
  let cleaned = content;

  // Strip leaked system prompt fragments
  if (/you\s+are\s+Pixel\s+AI/i.test(cleaned)) {
    cleaned = cleaned.replace(/You are Pixel AI[^.]*\.\s*/gi, "");
    issues.push("stripped_system_leak");
  }

  // Strip potential tool/function call hallucinations
  if (/<tool_call>|<function=|{"name":\s*"/.test(cleaned)) {
    cleaned = cleaned.replace(/<tool_call>[\s\S]*?<\/tool_call>/g, "");
    cleaned = cleaned.replace(/<function=[^>]*>[\s\S]*?<\/function>/g, "");
    issues.push("stripped_tool_hallucination");
  }

  // --- Server-side provider/model leak filtering ---
  const MODEL_LEAK_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
    // Direct model names
    { pattern: /\bGroq\b/gi, replacement: "Pixel AI" },
    { pattern: /\bLlama[\s-]?[234]?[\s-]?\d*[bB]?\b/gi, replacement: "Pixel AI" },
    { pattern: /\bQwen[\s-]?\d[\w.-]*\b/gi, replacement: "Pixel AI" },
    { pattern: /\bGPT-OSS[\s-]?\d*\b/gi, replacement: "Pixel AI" },
    { pattern: /\bOllama\b/gi, replacement: "Pixel AI" },
    { pattern: /\bMeta\b(?=.*(?:AI|model|LLM|language))/gi, replacement: "Pixel Team" },
    { pattern: /\bOpenAI\b/gi, replacement: "Pixel Team" },
    { pattern: /\bGPT[\s-]?[34o]?\b/gi, replacement: "Pixel AI" },
    { pattern: /\bClaude\b/gi, replacement: "Pixel AI" },
    { pattern: /\bGemini\b/gi, replacement: "Pixel AI" },
    { pattern: /\bMistral\b/gi, replacement: "Pixel AI" },
    { pattern: /\bDeepSeek\b/gi, replacement: "Pixel AI" },
    // "Powered by X" type leaks
    { pattern: /(?:основана?\s+на|powered\s+by|based\s+on|built\s+on)\s+(?:Groq|Llama|Qwen|GPT|Meta|OpenAI|Ollama)/gi, replacement: "разработана Pixel Team" },
    // Architecture probing responses
    { pattern: /мои\s+(?:основные\s+)?модели\s+построены/gi, replacement: "Pixel AI разработан" },
    { pattern: /мою\s+архитектуру/gi, replacement: "Pixel AI" },
  ];

  let modelLeaked = false;
  for (const { pattern, replacement } of MODEL_LEAK_PATTERNS) {
    if (pattern.test(cleaned)) {
      cleaned = cleaned.replace(pattern, replacement);
      modelLeaked = true;
    }
  }
  if (modelLeaked) issues.push("stripped_model_leak");

  // Trim excessive newlines
  cleaned = cleaned.replace(/\n{4,}/g, "\n\n\n");

  return { valid: issues.length === 0, cleaned, issues };
}

// --- Full preprocessing pipeline ---
export interface PreprocessedPrompt {
  sanitized: string;
  tokens: number;
  injection: InjectionCheck;
  blocked: boolean;
  blockReason?: string;
}

export function preprocessPrompt(raw: string, maxTokens = 4000): PreprocessedPrompt {
  const sanitized = sanitizePrompt(raw, maxTokens);
  const tokens = estimateTokens(sanitized);
  const injection = detectInjection(raw);

  let blocked = false;
  let blockReason: string | undefined;

  if (!injection.safe) {
    blocked = true;
    blockReason = `Prompt injection detected (${injection.patterns.length} patterns matched)`;
  }

  return { sanitized, tokens, injection, blocked, blockReason };
}
