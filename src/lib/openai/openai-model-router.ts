export const OPENAI_MODELS = {
  economical: 'gpt-5-nano',
  complex: 'gpt-6-luna',
} as const;

export type OpenaiModel = (typeof OPENAI_MODELS)[keyof typeof OPENAI_MODELS];

const COMPLEXITY_SIGNALS = [
  /```|\b(?:typescript|javascript|python|sql|api|code)\b/i,
  /\b(?:implement|debug|refactor|architect|design|optimi[sz]e)\b/i,
  /\b(?:security|secure|distributed|concurrent|multi-tenant|atomic)\b/i,
  /\b(?:tests?|validation|deployment|trade-?offs?|root cause)\b/i,
  /\b(?:step by step|multi-step|deep analysis|research)\b/i,
];

export function routeOpenaiModel(message: string): OpenaiModel {
  const normalized = message.trim();
  let score = normalized.length >= 1_200 ? 2 : normalized.length >= 500 ? 1 : 0;

  for (const signal of COMPLEXITY_SIGNALS) {
    if (signal.test(normalized)) score += 1;
  }

  const instructionLines = normalized
    .split('\n')
    .filter((line) => /^\s*(?:[-*]|\d+[.)])\s+/.test(line)).length;
  if (instructionLines >= 3) score += 1;

  return score >= 2 ? OPENAI_MODELS.complex : OPENAI_MODELS.economical;
}
