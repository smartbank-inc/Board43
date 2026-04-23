use std::{
    error::Error,
    fs::{create_dir_all, read},
    path::PathBuf,
};

use board43_image_transformer::transform;
use clap::Parser;

#[derive(Debug, Parser)]
#[clap(about, version)]
struct Args {
    /// Image files to process
    #[arg(required = true)]
    inputs: Vec<PathBuf>,

    /// Output directory
    #[arg(short, long, default_value = "output")]
    output: PathBuf,
}

fn main() -> Result<(), Box<dyn Error>> {
    let args = Args::parse();
    create_dir_all(&args.output)?;

    for path in &args.inputs {
        let out = args.output.join(path.file_stem().unwrap()).with_extension("png");
        eprintln!("{} -> {}", path.display(), out.display());
        transform(&read(path)?)?.save(&out)?;
    }
    Ok(())
}
