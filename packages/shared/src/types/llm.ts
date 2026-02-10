/** Chat message for LLM conversation */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/** Options for LLM generation */
export interface LLMOptions {
  temperature?: number
  maxTokens?: number
  model?: string
}

/** Response from LLM provider */
export interface LLMResponse {
  content: string
  usage?: {
    inputTokens: number
    outputTokens: number
  }
}

/** Interface all LLM providers must implement */
export interface LLMProvider {
  id: string
  name: string
  /** Default model used when none is specified */
  defaultModel: string
  generate(prompt: string, options?: LLMOptions): Promise<LLMResponse>
  generateChat(messages: ChatMessage[], options?: LLMOptions): Promise<LLMResponse>
  /** Check if this provider is configured and reachable */
  isAvailable(): Promise<boolean>
}

/** Per-agent LLM configuration */
export interface AgentLLMConfig {
  provider: string
  model?: string
  apiKey?: string
}
