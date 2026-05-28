use std::env;
use std::fs;
use std::io::{self, Read, Write};
use std::path::PathBuf;

use anyhow::{Context, Result, anyhow, bail};
use kreuzberg::pdf::render_pdf_page_to_png;
use kreuzberg::{
    ExtractionConfig, FormatMetadata, ImageExtractionConfig, LlmConfig, OcrConfig,
    detect_mime_type, extract_file,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;

const COMMAND_EXTRACT: &str = "extract";
const COMMAND_DETECT_MIME: &str = "detect-mime";
const COMMAND_RENDER_PDF_PAGE: &str = "render-pdf-page";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExtractRequest {
    file_path: PathBuf,
    mime_type: Option<String>,
    config: Option<Value>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ExtractResponse {
    content: String,
    mime_type: String,
    page_count: Option<usize>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DetectMimeRequest {
    file_path: PathBuf,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DetectMimeResponse {
    mime_type: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RenderPdfPageRequest {
    file_path: PathBuf,
    page_index: usize,
    dpi: Option<i32>,
    password: Option<String>,
}

#[tokio::main]
async fn main() {
    if let Err(error) = run().await {
        eprintln!("{error:#}");
        std::process::exit(1);
    }
}

async fn run() -> Result<()> {
    let command = env::args()
        .nth(1)
        .ok_or_else(|| anyhow!("missing command"))?;

    match command.as_str() {
        COMMAND_EXTRACT => extract().await,
        COMMAND_DETECT_MIME => detect_mime(),
        COMMAND_RENDER_PDF_PAGE => render_pdf_page(),
        _ => bail!("unknown command: {command}"),
    }
}

async fn extract() -> Result<()> {
    let request: ExtractRequest = read_json_request()?;
    let config = build_extraction_config(request.config.as_ref())?;
    let result = extract_file(&request.file_path, request.mime_type.as_deref(), &config)
        .await
        .with_context(|| format!("failed to extract document {}", request.file_path.display()))?;

    write_json_response(&ExtractResponse {
        content: result.content,
        mime_type: result.mime_type.into_owned(),
        page_count: extract_page_count(&result.metadata),
    })
}

fn detect_mime() -> Result<()> {
    let request: DetectMimeRequest = read_json_request()?;
    let mime_type = detect_mime_type(&request.file_path, true).with_context(|| {
        format!(
            "failed to detect MIME type for {}",
            request.file_path.display()
        )
    })?;

    write_json_response(&DetectMimeResponse { mime_type })
}

fn render_pdf_page() -> Result<()> {
    let request: RenderPdfPageRequest = read_json_request()?;
    let pdf_bytes = fs::read(&request.file_path)
        .with_context(|| format!("failed to read PDF {}", request.file_path.display()))?;
    let png_bytes = render_pdf_page_to_png(
        &pdf_bytes,
        request.page_index,
        request.dpi,
        request.password.as_deref(),
    )
    .with_context(|| {
        format!(
            "failed to render page {} from {}",
            request.page_index,
            request.file_path.display()
        )
    })?;

    io::stdout()
        .write_all(&png_bytes)
        .context("failed to write rendered PNG")?;
    Ok(())
}

fn read_json_request<T>() -> Result<T>
where
    T: for<'de> Deserialize<'de>,
{
    let mut input = String::new();
    io::stdin()
        .read_to_string(&mut input)
        .context("failed to read request JSON from stdin")?;
    serde_json::from_str(&input).context("failed to parse request JSON")
}

fn write_json_response<T>(response: &T) -> Result<()>
where
    T: Serialize,
{
    serde_json::to_writer(io::stdout(), response).context("failed to write JSON response")?;
    Ok(())
}

fn build_extraction_config(raw: Option<&Value>) -> Result<ExtractionConfig> {
    let mut config = ExtractionConfig::default();
    let Some(raw) = raw else {
        return Ok(config);
    };

    config.force_ocr = optional_bool(raw, &["force_ocr", "forceOcr"]).unwrap_or(config.force_ocr);
    config.disable_ocr =
        optional_bool(raw, &["disable_ocr", "disableOcr"]).unwrap_or(config.disable_ocr);

    if let Some(ocr) = raw.get("ocr") {
        config.ocr = Some(build_ocr_config(ocr)?);
    }

    if let Some(images) = raw.get("images") {
        config.images = Some(build_image_extraction_config(images));
    }

    Ok(config)
}

fn build_ocr_config(raw: &Value) -> Result<OcrConfig> {
    let backend = optional_string(raw, &["backend"]).unwrap_or_else(|| "tesseract".to_string());
    let language = optional_string(raw, &["language"]).unwrap_or_else(|| "eng".to_string());
    let vlm_config = first_value(raw, &["vlm_config", "vlmConfig"])
        .map(build_llm_config)
        .transpose()?;

    Ok(OcrConfig {
        backend,
        language,
        vlm_config,
        ..Default::default()
    })
}

fn build_llm_config(raw: &Value) -> Result<LlmConfig> {
    let model = optional_string(raw, &["model"]).ok_or_else(|| anyhow!("missing VLM model"))?;

    Ok(LlmConfig {
        model,
        api_key: optional_string(raw, &["api_key", "apiKey"]),
        base_url: optional_string(raw, &["base_url", "baseUrl"]),
        timeout_secs: optional_u64(raw, &["timeout_secs", "timeoutSecs"]),
        max_retries: optional_u64(raw, &["max_retries", "maxRetries"]).map(|value| value as u32),
        temperature: optional_f64(raw, &["temperature"]),
        max_tokens: optional_u64(raw, &["max_tokens", "maxTokens"]),
    })
}

fn build_image_extraction_config(raw: &Value) -> ImageExtractionConfig {
    ImageExtractionConfig {
        extract_images: optional_bool(raw, &["extract_images", "extractImages"]).unwrap_or(true),
        target_dpi: optional_i32(raw, &["target_dpi", "targetDpi"]).unwrap_or(300),
        max_image_dimension: optional_i32(raw, &["max_image_dimension", "maxImageDimension"])
            .unwrap_or(4096),
        inject_placeholders: optional_bool(raw, &["inject_placeholders", "injectPlaceholders"])
            .unwrap_or(true),
        auto_adjust_dpi: optional_bool(raw, &["auto_adjust_dpi", "autoAdjustDpi"]).unwrap_or(true),
        min_dpi: optional_i32(raw, &["min_dpi", "minDpi"]).unwrap_or(72),
        max_dpi: optional_i32(raw, &["max_dpi", "maxDpi"]).unwrap_or(600),
        max_images_per_page: optional_u64(raw, &["max_images_per_page", "maxImagesPerPage"])
            .map(|value| value as u32),
    }
}

fn extract_page_count(metadata: &kreuzberg::Metadata) -> Option<usize> {
    if let Some(FormatMetadata::Pdf(pdf)) = &metadata.format {
        if pdf.page_count.is_some() {
            return pdf.page_count;
        }
    }

    metadata
        .additional
        .iter()
        .find(|(key, _)| key.as_ref() == "page_count" || key.as_ref() == "pageCount")
        .and_then(|(_, value)| value.as_u64())
        .map(|value| value as usize)
}

fn first_value<'a>(raw: &'a Value, keys: &[&str]) -> Option<&'a Value> {
    keys.iter().find_map(|key| raw.get(*key))
}

fn optional_string(raw: &Value, keys: &[&str]) -> Option<String> {
    first_value(raw, keys).and_then(|value| value.as_str().map(ToOwned::to_owned))
}

fn optional_bool(raw: &Value, keys: &[&str]) -> Option<bool> {
    first_value(raw, keys).and_then(Value::as_bool)
}

fn optional_i32(raw: &Value, keys: &[&str]) -> Option<i32> {
    optional_u64(raw, keys).map(|value| value as i32)
}

fn optional_u64(raw: &Value, keys: &[&str]) -> Option<u64> {
    first_value(raw, keys).and_then(Value::as_u64)
}

fn optional_f64(raw: &Value, keys: &[&str]) -> Option<f64> {
    first_value(raw, keys).and_then(Value::as_f64)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_vlm_config_from_node_style_keys() {
        let raw = serde_json::json!({
            "forceOcr": true,
            "images": {
                "maxImageDimension": 1200
            },
            "ocr": {
                "backend": "vlm",
                "vlmConfig": {
                    "model": "openai/gpt-5.4-mini",
                    "baseUrl": "https://example.test/v1",
                    "apiKey": "test-key"
                }
            }
        });

        let config = build_extraction_config(Some(&raw)).expect("config should parse");
        let ocr = config.ocr.expect("OCR config should be present");
        let llm = ocr.vlm_config.expect("VLM config should be present");

        assert!(config.force_ocr);
        assert_eq!(config.images.unwrap().max_image_dimension, 1200);
        assert_eq!(ocr.backend, "vlm");
        assert_eq!(llm.model, "openai/gpt-5.4-mini");
        assert_eq!(llm.base_url.as_deref(), Some("https://example.test/v1"));
        assert_eq!(llm.api_key.as_deref(), Some("test-key"));
    }

    #[test]
    fn builds_paddle_config_from_eval_backend() {
        let raw = serde_json::json!({
            "ocr": {
                "backend": "paddle-ocr"
            }
        });

        let config = build_extraction_config(Some(&raw)).expect("config should parse");
        let ocr = config.ocr.expect("OCR config should be present");

        assert_eq!(ocr.backend, "paddle-ocr");
    }
}
