export interface ContextModel {
  name: string;
  tokens: number;
}

// Fallback if models.json is missing or corrupted
const FALLBACK: ContextModel[] = [
  { name: 'GPT-5.5 Pro', tokens: 1_050_000 },
  { name: 'Claude Opus 4.7', tokens: 1_000_000 },
  { name: 'Gemini 2.5 Pro', tokens: 1_048_576 },
  { name: 'DeepSeek V4 Pro', tokens: 1_048_576 },
  { name: 'Llama 4 Maverick', tokens: 1_048_576 },
];

export function getContextModels(): ContextModel[] {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('./models.json') as ContextModel[];
  } catch {
    return FALLBACK;
  }
}
