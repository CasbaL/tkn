/// Map model name to tiktoken encoding name
pub fn model_to_encoding(model: &str) -> &'static str {
    match model {
        // o200k_base models
        m if m.starts_with("o1") || m.starts_with("o3") || m.starts_with("gpt-4o") => {
            "o200k_base"
        }
        // cl100k_base models (GPT-4, GPT-3.5-turbo, etc.)
        m if m.starts_with("gpt-4") || m.starts_with("gpt-3.5") => "cl100k_base",
        // codex
        m if m.starts_with("code-") => "p50k_base",
        // default
        _ => "cl100k_base",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_model_encoding() {
        assert_eq!(model_to_encoding("gpt-4o"), "o200k_base");
        assert_eq!(model_to_encoding("gpt-4o-mini"), "o200k_base");
        assert_eq!(model_to_encoding("gpt-4"), "cl100k_base");
        assert_eq!(model_to_encoding("gpt-4-turbo"), "cl100k_base");
        assert_eq!(model_to_encoding("gpt-3.5-turbo"), "cl100k_base");
        assert_eq!(model_to_encoding("unknown"), "cl100k_base");
    }
}
