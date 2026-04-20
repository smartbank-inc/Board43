use std::{
    error::Error,
    fs::{create_dir_all, write},
    path::PathBuf,
    process::exit,
};

use clap::Parser;
use env_logger::{Builder, Env};
use log::{error, info};
use tempdir::TempDir;
use tokio::{runtime::Runtime, select, signal::ctrl_c, spawn};
use typwriter::{
    CompileParams, FittingType, FormatParams, PdfStandard, compile, format, list_fonts, watch,
};

mod metadata;
mod nup;

#[derive(Parser)]
#[clap(about = "Compile and watch Typst documents")]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Parser)]
enum Command {
    /// Compile Typst files to PDF.
    Compile {
        /// Path to input Typst file.
        #[arg(default_value = "reference-manual/main.typ")]
        input: PathBuf,

        /// Path to output directory.
        #[arg(short, long, default_value = "reference-manual")]
        output_dir: PathBuf,

        /// Additional directories to search for fonts.
        #[arg(long)]
        font_paths: Option<Vec<PathBuf>>,

        /// Path to metadata YAML file for PDF document properties.
        #[arg(long, default_value = "reference-manual/metadata.yml")]
        metadata: PathBuf,

        /// Generate n-up PDF (e.g. "1x2", "2x2").
        #[arg(long, value_name = "COLSxROWS")]
        nup: Option<String>,

        /// Flip n-up output page orientation.
        #[arg(long, requires = "nup")]
        flip: bool,
    },

    /// Watch Typst files and recompile on changes.
    Watch {
        /// Path to input Typst file.
        #[arg(default_value = "reference-manual/main.typ")]
        input: PathBuf,

        /// Additional directories to search for fonts.
        #[arg(long)]
        font_paths: Option<Vec<PathBuf>>,

        /// Application to open the output PDF file.
        #[arg(long, default_value = "Google Chrome.app")]
        app: String,

        /// PDF viewer fitting type.
        #[arg(long, value_parser = ["page", "width", "height"], default_value = "page")]
        fitting_type: String,
    },

    /// Format Typst files.
    Format {
        /// Path to input Typst file.
        #[arg(default_value = "reference-manual/main.typ")]
        input: PathBuf,

        /// Column width.
        #[arg(long, default_value = "80")]
        column: usize,
    },

    /// List available fonts.
    ListFonts {
        /// Additional directories to search for fonts.
        #[arg(long)]
        font_paths: Option<Vec<PathBuf>>,
    },
}

fn parse_nup(s: &str) -> Result<(u32, u32), String> {
    let parts: Vec<&str> = s.split('x').collect();
    if parts.len() != 2 {
        return Err(format!("expected COLSxROWS (e.g. 1x2), got {s}"));
    }
    let cols = parts[0].parse::<u32>().map_err(|e| e.to_string())?;
    let rows = parts[1].parse::<u32>().map_err(|e| e.to_string())?;
    Ok((cols, rows))
}

fn main() -> Result<(), Box<dyn Error>> {
    Builder::from_env(Env::default().default_filter_or("info")).init();
    let cli = Cli::parse();

    match cli.command {
        Command::Compile { input, output_dir, font_paths, metadata: metadata_path, nup: nup_opt, flip } => {
            create_dir_all(&output_dir)?;
            let output_dir = output_dir.canonicalize()?;
            let input = input.canonicalize()?;
            let stem = match input.file_stem().unwrap().to_str().unwrap() {
                "main" => input.parent().unwrap().file_name().unwrap().to_string_lossy(),
                other => other.into(),
            };
            let output = output_dir.join(format!("{stem}.pdf"));
            let params = CompileParams {
                input: input.clone(),
                output: output.clone(),
                font_paths: font_paths.unwrap_or_default(),
                dict: vec![],
                ppi: None,
                package_path: None,
                package_cache_path: None,
                pdf_standards: Some(vec![PdfStandard::V1_7]),
            };

            info!(r#"Compiling "{}""#, input.display());
            match compile(&params) {
                Ok(duration) => {
                    info!(r#"Compiled "{}" in {duration:?}"#, params.output.display())
                }
                Err(why) => {
                    error!("{why}");
                    exit(1);
                }
            }

            info!(r#"Applying metadata from "{}""#, metadata_path.display());
            let doc = metadata::load_metadata(&metadata_path)?;
            metadata::apply_metadata(&output, &doc)?;

            if let Some(ref nup_str) = nup_opt {
                let (cols, rows) = parse_nup(nup_str)?;
                let nup_output = output_dir.join(format!("{stem}-{cols}x{rows}.pdf"));
                nup::nup(&output, &nup_output, cols, rows, flip)?;
            }
        }

        Command::Watch { input, font_paths, app, fitting_type } => {
            let input = input.canonicalize()?;
            let temp_dir = TempDir::new("docs")?;
            info!("Temporary directory: {:?}", temp_dir.path());

            let params = CompileParams {
                input: input.clone(),
                output: temp_dir.path().join("watch.pdf"),
                font_paths: font_paths.unwrap_or_default(),
                dict: vec![],
                ppi: None,
                package_path: None,
                package_cache_path: None,
                pdf_standards: Some(vec![PdfStandard::V1_7]),
            };

            let rt = Runtime::new()?;
            rt.block_on(async {
                let handle = spawn(async move {
                    if let Err(e) = watch(&params, true, Some(&app), Some(FittingType::from(fitting_type.as_str()))).await
                    {
                        error!("Watch error for {:?}: {e}", params.input);
                    }
                });

                select! {
                    _ = ctrl_c() => {
                        info!("Shutting down...");
                    }
                    _ = handle => {}
                }
            });
        }

        Command::Format { input, column } => {
            if !input.exists() {
                error!(r#""{}" not found"#, input.display());
                exit(1);
            }
            match format(&FormatParams { input: input.clone(), column, tab_spaces: 2 }) {
                Ok(s) => {
                    write(&input, s)?;
                    info!(r#"Formatted "{}""#, input.display());
                }
                Err(why) => error!("{why:#?}"),
            }
        }

        Command::ListFonts { font_paths } => {
            let list = list_fonts(&font_paths.unwrap_or_default());
            for (family, fontinfo) in &list {
                println!("{family}:");
                let mut variants: Vec<_> = fontinfo
                    .iter()
                    .map(|info| {
                        format!(
                            "  - Style: {:?}, Weight: {:?}, Stretch: {:?}",
                            info.variant.style, info.variant.weight, info.variant.stretch
                        )
                    })
                    .collect();
                variants.sort();
                for v in variants {
                    println!("{v}");
                }
            }
        }
    }

    Ok(())
}
