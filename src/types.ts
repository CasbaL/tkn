export interface ScanOptions {
  include: string[];
  exclude: string[];
  respectGitignore: boolean;
  model: string;
  tokenizer: string;
  includeAll: boolean;
}

export interface FileStat {
  path: string;
  tokens: number;
  bytes: number;
  lines: number;
  category: 'logic' | 'config' | 'docs';
}

export interface ExtensionStat {
  extension: string;
  fileCount: number;
  tokenCount: number;
  byteCount: number;
  lineCount: number;
}

export interface CategoryStat {
  category: string;
  fileCount: number;
  tokenCount: number;
  byteCount: number;
  lineCount: number;
}

export interface ScanResult {
  totalTokens: number;
  totalFiles: number;
  totalBytes: number;
  totalLines: number;
  byExtension: ExtensionStat[];
  byCategory: CategoryStat[];
  files: FileStat[];
}

export interface TknConfig {
  include?: string[];
  exclude?: string[];
  respectGitignore?: boolean;
  model?: string;
  tokenizer?: string;
  includeAll?: boolean;
  output?: 'table' | 'json';
}
