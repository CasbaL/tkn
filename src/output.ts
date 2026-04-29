import chalk from 'chalk';
import Table from 'cli-table3';
import type { ScanResult } from './types.js';

const CONTEXT_WINDOWS: { name: string; tokens: number }[] = [
  { name: 'GPT-5.5', tokens: 1_000_000 },
  { name: 'GPT-5.5 Codex', tokens: 400_000 },
  { name: 'Claude 4.7 Opus', tokens: 500_000 },
  { name: 'Gemini 3.1 Pro', tokens: 2_000_000 },
  { name: 'DeepSeek V4 Pro', tokens: 256_000 },
  { name: 'Llama 4.0', tokens: 128_000 },
];

const LARGE_FILE_THRESHOLD = 2000;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

function bar(ratio: number, width = 20): string {
  const clamped = Math.min(Math.max(ratio, 0), 1);
  const filled = Math.round(clamped * width);
  const empty = width - filled;
  const str = '█'.repeat(filled) + '░'.repeat(empty);
  if (ratio > 1) return chalk.red(str);
  if (ratio > 0.8) return chalk.red(str);
  if (ratio > 0.5) return chalk.yellow(str);
  return chalk.green(str);
}

function tableChars() {
  return {
    top: '', 'top-mid': '', 'top-left': '', 'top-right': '',
    bottom: '', 'bottom-mid': '', 'bottom-left': '', 'bottom-right': '',
    left: '  ', 'left-mid': '', mid: '', 'mid-mid': '',
    right: '', 'right-mid': '', middle: ' ',
  };
}

function makeTable(head: string[]) {
  return new Table({
    head: head.map(h => chalk.cyan(h)),
    style: { head: [], border: [] },
    chars: tableChars(),
  });
}

export function printTable(result: ScanResult): void {
  console.log();
  console.log(chalk.bold('  tkn') + chalk.dim(' — Token Estimation'));
  console.log();

  // Summary
  console.log(
    chalk.bold(`  Total: ${chalk.cyan(formatNumber(result.totalTokens))} tokens`) +
      chalk.dim(` | ${formatNumber(result.totalLines)} lines | ${result.totalFiles} files | ${formatBytes(result.totalBytes)}`),
  );
  console.log();

  // By Category
  if (result.byCategory.length > 0) {
    console.log(chalk.bold('  By Category:'));
    const catTable = makeTable(['Category', 'Files', 'Lines', 'Tokens', 'Size', '']);

    const catLabels: Record<string, string> = {
      logic: chalk.green('Logic'),
      config: chalk.yellow('Config'),
      docs: chalk.blue('Docs'),
    };

    for (const cat of result.byCategory) {
      const ratio = result.totalTokens > 0 ? cat.tokenCount / result.totalTokens : 0;
      catTable.push([
        catLabels[cat.category] ?? cat.category,
        formatNumber(cat.fileCount),
        formatNumber(cat.lineCount),
        formatNumber(cat.tokenCount),
        formatBytes(cat.byteCount),
        bar(ratio) + chalk.dim(` ${Math.round(ratio * 100)}%`),
      ]);
    }

    console.log(catTable.toString());
    console.log();
  }

  // By Extension (top 10)
  if (result.byExtension.length > 0) {
    console.log(chalk.bold('  By Extension:'));
    const extTable = makeTable(['Extension', 'Files', 'Lines', 'Tokens', 'Size']);
    const top = result.byExtension.slice(0, 10);

    for (const ext of top) {
      extTable.push([
        ext.extension,
        formatNumber(ext.fileCount),
        formatNumber(ext.lineCount),
        formatNumber(ext.tokenCount),
        formatBytes(ext.byteCount),
      ]);
    }

    console.log(extTable.toString());
    console.log();
  }

  // Top 10 files
  if (result.files.length > 0) {
    const top = result.files.slice(0, 10);
    console.log(chalk.bold(`  Top ${top.length} Files:`));
    const fileTable = makeTable(['File', 'Lines', 'Tokens', 'Size']);

    for (const file of top) {
      const flag = file.tokens > LARGE_FILE_THRESHOLD ? ' \u{1F6A9}' : '';
      fileTable.push([
        file.path + flag,
        formatNumber(file.lines),
        formatNumber(file.tokens),
        formatBytes(file.bytes),
      ]);
    }

    console.log(fileTable.toString());
    console.log();
  }

  // Context Check
  printContextCheck(result.totalTokens);
}

function printContextCheck(totalTokens: number): void {
  console.log(chalk.bold('  Context Check:'));

  const table = new Table({
    style: { head: [], border: [] },
    chars: tableChars(),
  });

  for (const model of CONTEXT_WINDOWS) {
    const ratio = totalTokens / model.tokens;
    const pct = Math.round(ratio * 100);
    const label = pct > 100 ? chalk.red(`${pct}% 超出`) : `${pct}%`;
    const nameCol = `${model.name} ${chalk.dim(`(${formatNumber(model.tokens)})`)}`;

    table.push([nameCol, bar(ratio), label]);
  }

  console.log(table.toString());
  console.log();
}

export function printJson(result: ScanResult): void {
  console.log(JSON.stringify(result, null, 2));
}
