use rand::Rng;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct InstanceConfig {
    pub domain: String,
    pub admin_email: String,
    pub admin_password: String,
    pub db_user: String,
    pub db_password: String,
    pub db_name: String,
    pub jwt_secret: String,
    pub jwt_refresh_secret: String,
    pub mfa_encryption_key: String,
}

fn config_dir() -> PathBuf {
    let dir = dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".gratonite-server");
    fs::create_dir_all(&dir).ok();
    dir
}

fn config_path() -> PathBuf {
    config_dir().join("config.json")
}

fn random_hex(len: usize) -> String {
    let mut rng = rand::rng();
    (0..len).map(|_| format!("{:02x}", rng.random::<u8>())).collect()
}

fn random_base64(len: usize) -> String {
    let mut rng = rand::rng();
    let bytes: Vec<u8> = (0..len).map(|_| rng.random::<u8>()).collect();
    base64::Engine::encode(&base64::engine::general_purpose::URL_SAFE_NO_PAD, &bytes)
}

pub fn load_config() -> Result<InstanceConfig, Box<dyn std::error::Error>> {
    let path = config_path();
    if !path.exists() {
        return Err("No config found. Instance not set up yet.".into());
    }
    let data = fs::read_to_string(path)?;
    let cfg: InstanceConfig = serde_json::from_str(&data)?;
    Ok(cfg)
}

pub fn ensure_config() -> Result<InstanceConfig, Box<dyn std::error::Error>> {
    let path = config_path();

    if path.exists() {
        return load_config();
    }

    // Generate new config with random secrets
    let cfg = InstanceConfig {
        domain: "localhost".into(),
        admin_email: "admin@localhost".into(),
        admin_password: random_hex(8),
        db_user: "gratonite".into(),
        db_password: random_hex(16),
        db_name: "gratonite".into(),
        jwt_secret: random_base64(48),
        jwt_refresh_secret: random_base64(48),
        mfa_encryption_key: random_hex(32),
    };

    let json = serde_json::to_string_pretty(&cfg)?;
    fs::write(&path, &json)?;

    // Restrict permissions on config file (contains secrets)
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&path, fs::Permissions::from_mode(0o600))?;
    }

    Ok(cfg)
}
