#!/usr/bin/env node

import { resolve } from 'node:path';
import { Command } from 'commander';
import ora from 'ora';
import { loadConfig, mergeConfig } from './config.js';
import { printJson, printTable } from './output.js';
import type { ScanOptions } from './types.js';

// Load native binding - try different naming conventions
function loadNative(): { scanAndCount: (root: string, options: ScanOptions) => unknown } {
  const candidates = [
    '../tkn-core.darwin-arm64.node',
    '../tkn-core.darwin-x64.node',
    '../tkn-core.linux-x64-gnu.node',
  ];
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch {
      // try next
    }
  }
  throw new Error('Could not load native tkn-core module. Did you run `npm run build`?');
}

const pkg = require('../package.json') as { version: string };

const program = new Command();

program
  .name('tkn')
  .description('Roughly estimate the total token count of a repository')
  .version(pkg.version)
  .argument('[path]', 'Path to scan', '.')
  .option('--include <globs...>', 'Glob patterns to include')
  .option('--exclude <globs...>', 'Glob patterns to exclude')
  .option('--no-gitignore', 'Do not respect .gitignore')
  .option('--model <model>', 'Model name for tokenizer lookup (default: gpt-4o)')
  .option('--tokenizer <tokenizer>', 'Tokenizer directly: o200k_base, cl100k_base, p50k_base, r50k_base')
  .option('--all', 'Include lock files (package-lock.json, Cargo.lock, etc.)')
  .option('--json', 'Output as JSON')
  .action((path: string, options) => {
    const root = resolve(path);
    const config = loadConfig(root);

    const merged = mergeConfig(config, {
      include: options.include,
      exclude: options.exclude,
      respectGitignore: options.gitignore,
      model: options.model,
      tokenizer: options.tokenizer,
      includeAll: options.all,
      output: options.json ? 'json' : undefined,
    });

    const scanOptions: ScanOptions = {
      include: merged.include,
      exclude: merged.exclude,
      respectGitignore: merged.respectGitignore,
      model: merged.model,
      tokenizer: merged.tokenizer,
      includeAll: merged.includeAll,
    };

    const isJson = merged.output === 'json';
    const spinner = isJson ? null : ora('Scanning files...').start();

    const native = loadNative();
    const result = native.scanAndCount(root, scanOptions) as import('./types.js').ScanResult;

    if (spinner) spinner.stop();

    if (isJson) {
      printJson(result);
    } else {
      printTable(result);
    }
  });

program.parse();
