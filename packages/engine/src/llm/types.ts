/**
 * LLM Router Types — Central type definitions for the dual LLM routing system.
 * Routes game LLM calls to either a local vLLM/Ollama server or OpenRouter cloud.
 */

/** All LLM call categories with routing strategies */
export type LLMCategory =
  | 'npc_action'
  | 'npc_conversation'
  | 'npc_reaction'
  | 'combat_tactics'
  | 'item_naming'
  | 'history_writing'
  | 'culture_generation'
  | 'guild_charter'
  | 'election_speech'
  | 'rumor_generation'
  | 'lore_book_writing'
  | 'free_action_interpret'
  | 'appearance_parsing'
  | 'portrait_prompt'
  | 'war_negotiation'
  | 'monster_dialogue'
  | 'treaty_terms'

export type LLMProviderName = 'local' | 'openrouter'

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LLMRequest {
  category: LLMCategory
  messages: LLMMessage[]
  model?: string
  max_tokens?: number
  temperature?: number
  response_format?: 'text' | 'json'
  timeout_ms?: number
}

export interface LLMResponse {
  content: string
  provider: LLMProviderName
  model: string
  latency_ms: number
  input_tokens?: number
  output_tokens?: number
}

export interface LLMProviderOptions {
  model?: string
  max_tokens: number
  temperature: number
  response_format: 'text' | 'json'
  timeout_ms: number
}

export interface LLMUsageStats {
  totalCalls: number
  totalInputTokens: number
  totalOutputTokens: number
  avgLatencyMs: number
  errorCount: number
}

/** Provider interface — implemented by LocalLLMProvider and OpenRouterProvider */
export interface LLMProvider {
  readonly name: LLMProviderName
  complete(messages: LLMMessage[], options: LLMProviderOptions): Promise<LLMResponse>
  isAvailable(): boolean
  getUsage(): LLMUsageStats
}

/** Routing rule for a category */
export interface RoutingRule {
  primary: LLMProviderName
  fallback: LLMProviderName
}

/** Default routing table */
export const DEFAULT_ROUTING_TABLE: Record<LLMCategory, RoutingRule> = {
  npc_action:            { primary: 'local', fallback: 'openrouter' },
  npc_conversation:      { primary: 'local', fallback: 'openrouter' },
  npc_reaction:          { primary: 'local', fallback: 'openrouter' },
  combat_tactics:        { primary: 'local', fallback: 'openrouter' },
  item_naming:           { primary: 'local', fallback: 'openrouter' },
  history_writing:       { primary: 'openrouter', fallback: 'local' },
  culture_generation:    { primary: 'openrouter', fallback: 'local' },
  guild_charter:         { primary: 'openrouter', fallback: 'local' },
  election_speech:       { primary: 'local', fallback: 'openrouter' },
  rumor_generation:      { primary: 'local', fallback: 'openrouter' },
  lore_book_writing:     { primary: 'openrouter', fallback: 'local' },
  free_action_interpret: { primary: 'local', fallback: 'openrouter' },
  appearance_parsing:    { primary: 'local', fallback: 'openrouter' },
  portrait_prompt:       { primary: 'local', fallback: 'openrouter' },
  war_negotiation:       { primary: 'openrouter', fallback: 'local' },
  monster_dialogue:      { primary: 'local', fallback: 'openrouter' },
  treaty_terms:          { primary: 'openrouter', fallback: 'local' },
}

/** Default max_tokens per category */
export const CATEGORY_DEFAULTS: Record<LLMCategory, { max_tokens: number; temperature: number; response_format: 'text' | 'json' }> = {
  npc_action:            { max_tokens: 500, temperature: 0.8, response_format: 'json' },
  npc_conversation:      { max_tokens: 80,  temperature: 0.9, response_format: 'text' },
  npc_reaction:          { max_tokens: 100, temperature: 0.8, response_format: 'json' },
  combat_tactics:        { max_tokens: 200, temperature: 0.6, response_format: 'json' },
  item_naming:           { max_tokens: 15,  temperature: 1.0, response_format: 'text' },
  history_writing:       { max_tokens: 300, temperature: 0.7, response_format: 'text' },
  culture_generation:    { max_tokens: 500, temperature: 0.8, response_format: 'json' },
  guild_charter:         { max_tokens: 200, temperature: 0.7, response_format: 'text' },
  election_speech:       { max_tokens: 150, temperature: 0.8, response_format: 'text' },
  rumor_generation:      { max_tokens: 80,  temperature: 0.9, response_format: 'text' },
  lore_book_writing:     { max_tokens: 300, temperature: 0.8, response_format: 'text' },
  free_action_interpret: { max_tokens: 200, temperature: 0.7, response_format: 'json' },
  appearance_parsing:    { max_tokens: 300, temperature: 0.5, response_format: 'json' },
  portrait_prompt:       { max_tokens: 150, temperature: 0.8, response_format: 'text' },
  war_negotiation:       { max_tokens: 400, temperature: 0.7, response_format: 'json' },
  monster_dialogue:      { max_tokens: 80,  temperature: 0.9, response_format: 'text' },
  treaty_terms:          { max_tokens: 300, temperature: 0.6, response_format: 'json' },
}

/** Usage log entry */
export interface UsageLogEntry {
  timestamp: number
  category: LLMCategory
  provider: LLMProviderName
  model: string
  input_tokens: number
  output_tokens: number
  latency_ms: number
  success: boolean
  error?: string
}
