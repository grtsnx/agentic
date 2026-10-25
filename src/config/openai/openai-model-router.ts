import type { ModelSettings } from '@openai/agents';
import type { OpenaiModel, OpenaiRoutingContext } from '@/config';
export const OPENAI_MODELS = {
  economical: 'gpt-5-nano',
  complex: 'gpt-6-luna',
} as const;

const COMPLEXITY_SIGNALS = [
  /```|\b(?:typescript|javascript|python|sql|api|code)\b/i,
  /\b(?:implement|debug|refactor|architect|design|optimi[sz]e)\b/i,
  /\b(?:security|secure|distributed|concurrent|multi-tenant|atomic)\b/i,
  /\b(?:tests?|validation|deployment|trade-?offs?|root cause)\b/i,
  /\b(?:step by step|multi-step|deep analysis|research)\b/i,
];

const TASK_INTENT =
  /\b(?:debug|refactor|implement|investigate|architect|research|troubleshoot|optimi[sz]e)\b|\b(?:root cause|deep analysis|multi-step|step by step)\b|\b(?:write|build|create|design|run|execute|propose|review|audit|compare)\b.*\b(?:code|script|function|service|api|architecture|system|security|sandbox|console\.log|database|trade-?offs?)\b/i;
const FOLLOW_UP =
  /^(?:yes|ok(?:ay)?|continue|proceed|go ahead|do it|carry on)\b|\b(?:this|that|it|those|same|above|again|further)\b/i;
const ACKNOWLEDGEMENT =
  /^(?:hi|hello|hey|thanks|thank you|good morning|good evening)[!.\s]*$/i;
const DEFINITION =
  /^(?:what (?:is|are|does)\b|define\b|explain the (?:term|meaning)\b)/i;

function classifyTask(message: string): OpenaiModel {
  // A definition mentioning technical words is not an engineering task.
  if (
    message.length < 240 &&
    DEFINITION.test(message) &&
    !/\b(?:and|then|how|why|compare|versus|vs)\b/i.test(message)
  )
    return OPENAI_MODELS.economical;
  if (TASK_INTENT.test(message)) return OPENAI_MODELS.complex;
  let score = message.length >= 1_200 ? 2 : message.length >= 500 ? 1 : 0;
  for (const signal of COMPLEXITY_SIGNALS) if (signal.test(message)) score += 1;
  const instructionLines = message
    .split('\n')
    .filter((line) => /^\s*(?:[-*]|\d+[.)])\s+/.test(line)).length;
  if (instructionLines >= 3) score += 1;
  return score >= 2 ? OPENAI_MODELS.complex : OPENAI_MODELS.economical;
}

export function routeOpenaiModel(
  message: string,
  context: OpenaiRoutingContext = {},
): OpenaiModel {
  const normalized = message.trim();
  if (ACKNOWLEDGEMENT.test(normalized)) return OPENAI_MODELS.economical;
  if (classifyTask(normalized) === OPENAI_MODELS.complex)
    return OPENAI_MODELS.complex;
  const followUp = normalized.length <= 320 && FOLLOW_UP.test(normalized);
  if (
    context.hasAttachments &&
    (followUp ||
      /\b(?:image|photo|document|pdf|file|attachment|screenshot)\b/i.test(
        normalized,
      ))
  )
    return OPENAI_MODELS.complex;
  if (followUp) {
    // Inspect bounded user context only. Tool payloads and assistant prose must not inflate routing scores.
    for (const previous of (context.recentUserMessages ?? [])
      .slice(-6)
      .reverse()) {
      const text = previous.trim().slice(0, 4000);
      if (ACKNOWLEDGEMENT.test(text)) continue;
      if (classifyTask(text) === OPENAI_MODELS.complex)
        return OPENAI_MODELS.complex;
      if (text.length <= 320 && FOLLOW_UP.test(text)) continue;
      break;
    }
  }
  return OPENAI_MODELS.economical;
}

// Simple requests do not need the provider's default reasoning budget.
export function openaiModelSettings(model: OpenaiModel): ModelSettings {
  return model === OPENAI_MODELS.economical
    ? { reasoning: { effort: 'low' } }
    : {};
}
