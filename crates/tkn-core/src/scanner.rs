use std::path::PathBuf;

use globset::{Glob, GlobSet, GlobSetBuilder};
use ignore::WalkBuilder;

use crate::ScanOptions;

/// Binary file extensions to always skip
const BINARY_EXTENSIONS: &[&str] = &[
    "png", "jpg", "jpeg", "gif", "bmp", "ico", "webp", "svg",
    "mp3", "mp4", "wav", "avi", "mov", "mkv", "flv", "wmv",
    "zip", "tar", "gz", "bz2", "rar", "7z", "xz",
    "exe", "dll", "so", "dylib", "bin",
    "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
    "woff", "woff2", "ttf", "eot",
    "pyc", "pyo", "class", "o", "obj",
];

/// Directories to always skip (in addition to .gitignore)
const SKIP_DIRS: &[&str] = &[
    ".git", "node_modules", "vendor", ".venv", "venv",
    "__pycache__", ".next", ".nuxt", ".cache", "dist", "build",
    "target", "out", ".output", ".turbo",
];

/// Max file size to scan (1MB)
const MAX_FILE_SIZE: u64 = 1_048_576;

/// Lock files to skip by default
const LOCK_FILES: &[&str] = &[
    "package-lock.json",
    "Cargo.lock",
    "yarn.lock",
    "pnpm-lock.yaml",
    "bun.lockb",
    "poetry.lock",
    "Gemfile.lock",
    "composer.lock",
    "go.sum",
];

fn build_glob_set(patterns: &[String]) -> Result<GlobSet, globset::Error> {
    let mut builder = GlobSetBuilder::new();
    for pattern in patterns {
        builder.add(Glob::new(pattern)?);
    }
    builder.build()
}

pub fn scan(root: &str, options: &ScanOptions) -> Result<Vec<PathBuf>, String> {
    let include_set = if options.include.is_empty() {
        None
    } else {
        Some(build_glob_set(&options.include).map_err(|e| format!("Invalid include glob: {}", e))?)
    };

    let exclude_set = if options.exclude.is_empty() {
        None
    } else {
        Some(build_glob_set(&options.exclude).map_err(|e| format!("Invalid exclude glob: {}", e))?)
    };

    let mut walker = WalkBuilder::new(root);
    walker
        .git_ignore(options.respect_gitignore)
        .git_global(options.respect_gitignore)
        .git_exclude(options.respect_gitignore)
        .hidden(true);

    let mut results = Vec::new();

    for entry in walker.build() {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };

        let path = entry.path();

        // Skip directories
        if path.is_dir() {
            continue;
        }

        let relative = match path.strip_prefix(root) {
            Ok(r) => r,
            Err(_) => path,
        };

        // Check if any ancestor is in SKIP_DIRS
        if relative.ancestors().any(|a| {
            a.file_name()
                .and_then(|f| f.to_str())
                .map(|f| SKIP_DIRS.contains(&f))
                .unwrap_or(false)
        }) {
            continue;
        }

        // Skip by file extension (binary)
        if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
            if BINARY_EXTENSIONS.contains(&ext.to_lowercase().as_str()) {
                continue;
            }
        }

        // Skip lock files unless --all
        if !options.include_all {
            if let Some(name) = path.file_name().and_then(|f| f.to_str()) {
                if LOCK_FILES.contains(&name) {
                    continue;
                }
            }
        }

        // Skip by file size
        if let Ok(metadata) = entry.metadata() {
            if metadata.len() > MAX_FILE_SIZE {
                continue;
            }
        }

        // Apply exclude overrides
        if let Some(ref exclude) = exclude_set {
            if exclude.is_match(relative) {
                continue;
            }
        }

        // Apply include overrides (if specified, only include matching files)
        if let Some(ref include) = include_set {
            if !include.is_match(relative) {
                continue;
            }
        }

        results.push(path.to_path_buf());
    }

    Ok(results)
}
