# tkn

粗略估算代码仓库的 token 总量。

Rust 核心（tiktoken-rs + ignore）负责高性能文件扫描与 token 计算，JS CLI 层负责配置与输出。

## 安装

```bash
npm install
npm run build
```

## 本地试用

```bash
npm install
npm run build
npm link        # 注册 tkn 为全局命令
```

之后即可在任意目录使用 `tkn`。修改代码后重新 `npm run build` 即可生效。

卸载：

```bash
npm unlink -g tkn
```

## 使用

```bash
# 扫描当前目录
tkn

# 扫描指定目录
tkn /path/to/project

# JSON 输出
tkn --json

# 指定模型（自动匹配 tokenizer）
tkn --model gpt-3.5-turbo

# 直接指定 tokenizer
tkn --tokenizer o200k_base

# 自定义过滤
tkn --include "*.ts" "*.tsx"
tkn --exclude "test/**" "fixtures/**"
tkn --no-gitignore
```

## 配置

在项目根目录创建 `tkn.config.ts`、`tkn.config.js` 或 `.tknrc.json`：

```json
{
  "include": [],
  "exclude": ["test/**"],
  "respectGitignore": true,
  "model": "gpt-4o",
  "tokenizer": "",
  "output": "table"
}
```

`--model` 根据模型名自动匹配 tokenizer；`--tokenizer` 直接指定，优先级更高。可选值：`o200k_base`、`cl100k_base`、`p50k_base`、`r50k_base`、`p50k_edit`。

命令行参数优先于配置文件。

## 过滤规则

**硬规则（内置，始终生效）：**
- 跳过 `.git`、`node_modules`、`dist`、`build`、`target`、`vendor` 等目录
- 跳过二进制文件（图片、音视频、压缩包、字体等）
- 跳过超过 1MB 的文件

**软规则（可配置）：**
- 默认遵循 `.gitignore`
- 支持 `--include` / `--exclude` glob 覆盖

## 支持的 Tokenizer

当前集成 tiktoken（OpenAI），可精确计算 OpenAI 模型的 token 数：

| Tokenizer | 词表大小 | 适用模型 |
|---|---|---|
| `o200k_base` | ~200k | GPT-4o、GPT-4o-mini、o1、o3 |
| `cl100k_base` | ~100k | GPT-4、GPT-4-turbo、GPT-3.5-turbo、text-embedding-* |
| `p50k_base` | ~50k | text-davinci-003/002、code-davinci-*（已废弃） |
| `r50k_base` | ~50k | davinci、curie、babbage、ada（已废弃） |

其他厂商模型的分词器尚未集成，但 BPE 方案词表有大量重叠，使用 `--model gpt-4o` 作为近似估算，误差通常在 10-20% 以内：

| 厂商 | 模型 | 分词器 | 备注 |
|---|---|---|---|
| Anthropic | Claude 全系列 | 自研（未开源） | 可用 o200k_base 近似 |
| DeepSeek | DeepSeek-V2/V3 | 自研 BPE | 可用 o200k_base 近似 |
| Google | Gemini 系列 | SentencePiece | 可用 o200k_base 近似 |
| Meta | LLaMA 3/3.1 | tiktoken 变体 | 可用 o200k_base 近似 |
| 阿里 | Qwen 2/2.5 | tiktoken 扩展 (~152k) | 可用 o200k_base 近似 |

## 技术栈

| 层 | 技术 |
|---|---|
| Tokenizer | tiktoken-rs (OpenAI cl100k_base / o200k_base) |
| 文件扫描 | ignore crate（.gitignore 解析 + 目录遍历） |
| 绑定 | napi-rs |
| CLI | commander + chalk + cli-table3 |
