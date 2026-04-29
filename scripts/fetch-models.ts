import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';

interface OpenRouterModel {
  id: string;
  name: string;
  context_length: number;
}

interface ContextModel {
  name: string;
  tokens: number;
}

const PROVIDERS = ['openai', 'anthropic', 'google', 'deepseek', 'meta-llama'];

const SKIP_KEYWORDS = ['lyria', 'veo', 'imagen', 'banana', 'tts', 'robotics', 'embedding'];
const SKIP_MODEL_KEYWORDS = ['preview', 'custom', 'experimental', 'free'];

const FLAGSHIP_KEYWORDS = ['pro', 'opus', 'large'];
const BUDGET_KEYWORDS = ['flash', 'lite', 'mini', 'nano', 'small', 'haiku', 'instant'];

function flagshipScore(id: string): number {
  const lower = id.toLowerCase();
  if (FLAGSHIP_KEYWORDS.some((k) => lower.includes(k))) return 2;
  if (BUDGET_KEYWORDS.some((k) => lower.includes(k))) return 0;
  return 1;
}

function fetchJson(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 15000 }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('timeout'));
    });
  });
}

async function main() {
  console.log('Fetching models from OpenRouter...');

  const resp = (await fetchJson('https://openrouter.ai/api/v1/models')) as {
    data: OpenRouterModel[];
  };

  const models = resp.data.filter(
    (m) =>
      PROVIDERS.some((p) => m.id.startsWith(p + '/')) &&
      !SKIP_KEYWORDS.some((k) => m.id.toLowerCase().includes(k)) &&
      !SKIP_MODEL_KEYWORDS.some((k) => m.id.toLowerCase().includes(k)),
  );

  const byProvider = new Map<string, ContextModel & { score: number }>();
  for (const m of models) {
    const provider = m.id.split('/')[0];
    const existing = byProvider.get(provider);
    const score = flagshipScore(m.id);
    if (
      !existing ||
      m.context_length > existing.tokens ||
      (m.context_length === existing.tokens && score > existing.score)
    ) {
      const cleanName = m.name.replace(/^[A-Za-z]+:\s*/, '');
      byProvider.set(provider, { name: cleanName, tokens: m.context_length, score });
    }
  }

  const result: ContextModel[] = Array.from(byProvider.values())
    .map(({ name, tokens }) => ({ name, tokens }))
    .sort((a, b) => b.tokens - a.tokens);

  const outPath = path.resolve(__dirname, '../src/models.json');
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n');
  console.log(`Written ${result.length} models to ${outPath}`);

  for (const m of result) {
    console.log(`  ${m.name}: ${(m.tokens / 1000).toLocaleString()}k`);
  }
}

main().catch((err) => {
  console.error('Failed to fetch models:', err);
  process.exit(1);
});
