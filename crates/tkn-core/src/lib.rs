#[macro_use]
extern crate napi_derive;

mod scanner;

use napi::bindgen_prelude::*;

const LOGIC_EXTENSIONS: &[&str] = &[
    "ts", "tsx", "js", "jsx", "mjs", "cjs",
    "rs", "go", "py", "java", "c", "cpp", "h", "hpp", "cs",
    "rb", "php", "swift", "kt", "scala", "ex", "exs",
    "lua", "r", "m", "mm", "vue", "svelte",
];

const DOC_EXTENSIONS: &[&str] = &[
    "md", "mdx", "txt", "rst", "adoc", "org",
];

fn classify(ext: &str) -> &'static str {
    if LOGIC_EXTENSIONS.contains(&ext) {
        "logic"
    } else if DOC_EXTENSIONS.contains(&ext) {
        "docs"
    } else {
        "config"
    }
}

fn count_lines(text: &str) -> i32 {
    if text.is_empty() {
        0
    } else {
        text.lines().count() as i32
    }
}

#[napi(object)]
pub struct ScanOptions {
    pub include: Vec<String>,
    pub exclude: Vec<String>,
    pub respect_gitignore: bool,
    pub model: String,
    pub tokenizer: String,
    pub include_all: bool,
}

#[napi(object)]
pub struct FileStat {
    pub path: String,
    pub tokens: i64,
    pub bytes: i64,
    pub lines: i32,
    pub category: String,
}

#[napi(object)]
pub struct ExtensionStat {
    pub extension: String,
    pub file_count: i32,
    pub token_count: i64,
    pub byte_count: i64,
    pub line_count: i32,
}

#[napi(object)]
pub struct CategoryStat {
    pub category: String,
    pub file_count: i32,
    pub token_count: i64,
    pub byte_count: i64,
    pub line_count: i32,
}

#[napi(object)]
pub struct ScanResult {
    pub total_tokens: i64,
    pub total_files: i32,
    pub total_bytes: i64,
    pub total_lines: i32,
    pub by_extension: Vec<ExtensionStat>,
    pub by_category: Vec<CategoryStat>,
    pub files: Vec<FileStat>,
}

fn resolve_bpe(options: &ScanOptions) -> Result<tiktoken_rs::CoreBPE> {
    if options.tokenizer.is_empty() {
        tiktoken_rs::get_bpe_from_model(&options.model)
            .map_err(|e| Error::from_reason(format!("Unknown model '{}': {}", options.model, e)))
    } else {
        let tokenizer = match options.tokenizer.as_str() {
            "o200k_base" => tiktoken_rs::tokenizer::Tokenizer::O200kBase,
            "cl100k_base" => tiktoken_rs::tokenizer::Tokenizer::Cl100kBase,
            "p50k_base" => tiktoken_rs::tokenizer::Tokenizer::P50kBase,
            "r50k_base" => tiktoken_rs::tokenizer::Tokenizer::R50kBase,
            "p50k_edit" => tiktoken_rs::tokenizer::Tokenizer::P50kEdit,
            _ => return Err(Error::from_reason(format!(
                "Unknown tokenizer '{}'. Valid options: o200k_base, cl100k_base, p50k_base, r50k_base, p50k_edit",
                options.tokenizer
            ))),
        };
        tiktoken_rs::get_bpe_from_tokenizer(tokenizer)
            .map_err(|e| Error::from_reason(format!("Tokenizer error: {}", e)))
    }
}

// (file_count, token_count, byte_count, line_count)
type StatTuple = (i32, i64, i64, i32);

#[napi]
pub fn scan_and_count(root: String, options: ScanOptions) -> Result<ScanResult> {
    let files = scanner::scan(&root, &options)
        .map_err(|e| Error::from_reason(format!("Scan error: {}", e)))?;

    let bpe = resolve_bpe(&options)?;

    let mut file_stats: Vec<FileStat> = Vec::new();
    let mut ext_map: std::collections::HashMap<String, StatTuple> =
        std::collections::HashMap::new();
    let mut cat_map: std::collections::HashMap<String, StatTuple> =
        std::collections::HashMap::new();

    for file_path in &files {
        let content = match std::fs::read(file_path) {
            Ok(bytes) => bytes,
            Err(_) => continue,
        };

        let text = match std::str::from_utf8(&content) {
            Ok(s) => s,
            Err(_) => continue,
        };

        let tokens = bpe.encode_with_special_tokens(text).len() as i64;
        let bytes = content.len() as i64;
        let lines = count_lines(text);

        let relative = file_path
            .strip_prefix(&root)
            .unwrap_or(file_path)
            .to_string_lossy()
            .trim_start_matches('/')
            .to_string();

        let ext = std::path::Path::new(&relative)
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_string();

        let category = classify(&ext).to_string();

        let ext_entry = ext_map.entry(ext.clone()).or_insert((0, 0, 0, 0));
        ext_entry.0 += 1;
        ext_entry.1 += tokens;
        ext_entry.2 += bytes;
        ext_entry.3 += lines;

        let cat_entry = cat_map.entry(category.clone()).or_insert((0, 0, 0, 0));
        cat_entry.0 += 1;
        cat_entry.1 += tokens;
        cat_entry.2 += bytes;
        cat_entry.3 += lines;

        file_stats.push(FileStat {
            path: relative,
            tokens,
            bytes,
            lines,
            category,
        });
    }

    let total_tokens: i64 = file_stats.iter().map(|f| f.tokens).sum();
    let total_bytes: i64 = file_stats.iter().map(|f| f.bytes).sum();
    let total_lines: i32 = file_stats.iter().map(|f| f.lines).sum();
    let total_files = file_stats.len() as i32;

    let mut by_extension: Vec<ExtensionStat> = ext_map
        .into_iter()
        .map(|(ext, (count, tokens, bytes, lines))| ExtensionStat {
            extension: if ext.is_empty() { "(none)".to_string() } else { format!(".{}", ext) },
            file_count: count,
            token_count: tokens,
            byte_count: bytes,
            line_count: lines,
        })
        .collect();

    let mut by_category: Vec<CategoryStat> = vec!["logic", "config", "docs"]
        .into_iter()
        .map(|cat| {
            let (count, tokens, bytes, lines) = cat_map.remove(cat).unwrap_or((0, 0, 0, 0));
            CategoryStat {
                category: cat.to_string(),
                file_count: count,
                token_count: tokens,
                byte_count: bytes,
                line_count: lines,
            }
        })
        .collect();

    by_extension.sort_by(|a, b| b.token_count.cmp(&a.token_count));
    by_category.sort_by(|a, b| b.token_count.cmp(&a.token_count));
    file_stats.sort_by(|a, b| b.tokens.cmp(&a.tokens));

    Ok(ScanResult {
        total_tokens,
        total_files,
        total_bytes,
        total_lines,
        by_extension,
        by_category,
        files: file_stats,
    })
}

#[napi]
pub fn format_for_copy(root: String, options: ScanOptions) -> Result<String> {
    let files = scanner::scan(&root, &options)
        .map_err(|e| Error::from_reason(format!("Scan error: {}", e)))?;

    let mut output = String::new();

    for file_path in &files {
        let content = match std::fs::read(file_path) {
            Ok(bytes) => bytes,
            Err(_) => continue,
        };

        let text = match std::str::from_utf8(&content) {
            Ok(s) => s,
            Err(_) => continue,
        };

        let relative = file_path
            .strip_prefix(&root)
            .unwrap_or(file_path)
            .to_string_lossy()
            .trim_start_matches('/')
            .to_string();

        output.push_str(&format!("--- {} ---\n", relative));
        output.push_str(text);
        output.push_str("\n\n");
    }

    Ok(output)
}
