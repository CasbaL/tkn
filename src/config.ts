import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { TknConfig } from './types.js';

const CONFIG_FILES = ['tkn.config.ts', 'tkn.config.js', '.tknrc.json'];

const DEFAULT_CONFIG: Required<TknConfig> = {
  include: [],
  exclude: [],
  respectGitignore: true,
  model: 'gpt-4o',
  tokenizer: '',
  includeAll: false,
  output: 'table',
};

export function loadConfig(root: string): TknConfig {
  for (const file of CONFIG_FILES) {
    const configPath = resolve(root, file);
    if (existsSync(configPath)) {
      if (file.endsWith('.json')) {
        const raw = readFileSync(configPath, 'utf-8');
        return JSON.parse(raw) as TknConfig;
      }
      // For .ts/.js config files, use dynamic import
      // Users can export default { ... }
      try {
        // Use require for .js, skip .ts (needs tsx/ts-node)
        if (file.endsWith('.js')) {
          return require(configPath) as TknConfig;
        }
      } catch {
        // ignore load errors
      }
    }
  }
  return {};
}

export function mergeConfig(
  config: TknConfig,
  cliArgs: Partial<TknConfig>,
): Required<TknConfig> {
  return {
    include: cliArgs.include ?? config.include ?? DEFAULT_CONFIG.include,
    exclude: cliArgs.exclude ?? config.exclude ?? DEFAULT_CONFIG.exclude,
    respectGitignore:
      cliArgs.respectGitignore ??
      config.respectGitignore ??
      DEFAULT_CONFIG.respectGitignore,
    model: cliArgs.model ?? config.model ?? DEFAULT_CONFIG.model,
    tokenizer: cliArgs.tokenizer ?? config.tokenizer ?? DEFAULT_CONFIG.tokenizer,
    includeAll: cliArgs.includeAll ?? config.includeAll ?? DEFAULT_CONFIG.includeAll,
    output: cliArgs.output ?? config.output ?? DEFAULT_CONFIG.output,
  };
}
