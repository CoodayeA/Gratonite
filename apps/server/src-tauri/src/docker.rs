use bollard::Docker;
use bollard::container::{
    Config, CreateContainerOptions, ListContainersOptions, LogsOptions,
    StartContainerOptions, StopContainerOptions, RemoveContainerOptions,
};
use bollard::image::CreateImageOptions;
use bollard::network::CreateNetworkOptions;
use bollard::volume::CreateVolumeOptions;
use bollard::models::{HostConfig, PortBinding, PortMap, Mount, MountTypeEnum};
use futures_util::StreamExt;
use serde::Serialize;
use std::collections::HashMap;
use tauri::Emitter;

use crate::config::{self, InstanceConfig};

const NETWORK_NAME: &str = "gratonite-server";
const IMAGES: &[&str] = &[
    "ghcr.io/coodayea/gratonite-setup:latest",
    "ghcr.io/coodayea/gratonite-api:latest",
    "ghcr.io/coodayea/gratonite-web:latest",
    "postgres:16-alpine",
    "redis:7-alpine",
    "caddy:2-alpine",
];

#[derive(Debug, Serialize, Clone)]
pub struct InstanceStatus {
    pub docker_running: bool,
    pub containers: Vec<ContainerInfo>,
    pub healthy: bool,
}

#[derive(Debug, Serialize, Clone)]
pub struct ContainerInfo {
    pub name: String,
    pub status: String,
    pub running: bool,
}

fn docker() -> Result<Docker, bollard::errors::Error> {
    Docker::connect_with_local_defaults()
}

pub async fn is_docker_running() -> Result<bool, Box<dyn std::error::Error>> {
    match docker() {
        Ok(d) => {
            d.ping().await?;
            Ok(true)
        }
        Err(_) => Ok(false),
    }
}

pub async fn get_instance_status() -> Result<InstanceStatus, Box<dyn std::error::Error>> {
    let d = docker()?;

    let docker_running = d.ping().await.is_ok();
    if !docker_running {
        return Ok(InstanceStatus {
            docker_running: false,
            containers: vec![],
            healthy: false,
        });
    }

    let mut filters = HashMap::new();
    filters.insert("label", vec!["com.gratonite.server=true"]);

    let containers = d
        .list_containers(Some(ListContainersOptions {
            all: true,
            filters,
            ..Default::default()
        }))
        .await?;

    let infos: Vec<ContainerInfo> = containers
        .iter()
        .map(|c| ContainerInfo {
            name: c.names.as_ref()
                .and_then(|n| n.first())
                .map(|n| n.trim_start_matches('/').to_string())
                .unwrap_or_default(),
            status: c.status.clone().unwrap_or_default(),
            running: c.state.as_deref() == Some("running"),
        })
        .collect();

    let healthy = infos.iter().filter(|c| c.name.contains("api")).any(|c| c.running);

    Ok(InstanceStatus {
        docker_running: true,
        containers: infos,
        healthy,
    })
}

pub async fn pull_images(app: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let d = docker()?;

    for (i, image) in IMAGES.iter().enumerate() {
        let _ = app.emit("pull-progress", serde_json::json!({
            "image": image,
            "index": i,
            "total": IMAGES.len(),
        }));

        let mut stream = d.create_image(
            Some(CreateImageOptions {
                from_image: *image,
                ..Default::default()
            }),
            None,
            None,
        );

        while let Some(result) = stream.next().await {
            match result {
                Ok(info) => {
                    if let Some(status) = &info.status {
                        let _ = app.emit("pull-layer", serde_json::json!({
                            "image": image,
                            "status": status,
                        }));
                    }
                }
                Err(e) => return Err(Box::new(e)),
            }
        }
    }

    let _ = app.emit("pull-progress", serde_json::json!({
        "image": "done",
        "index": IMAGES.len(),
        "total": IMAGES.len(),
    }));

    Ok(())
}

pub async fn start_instance(
    app: &tauri::AppHandle,
    cfg: &InstanceConfig,
) -> Result<(), Box<dyn std::error::Error>> {
    let d = docker()?;

    let _ = app.emit("setup-step", "Pulling images...");
    pull_images(app).await?;

    let _ = app.emit("setup-step", "Creating network...");
    ensure_network(&d).await?;

    let _ = app.emit("setup-step", "Creating volumes...");
    ensure_volumes(&d).await?;

    let _ = app.emit("setup-step", "Starting PostgreSQL...");
    start_postgres(&d, cfg).await?;

    let _ = app.emit("setup-step", "Starting Redis...");
    start_redis(&d).await?;

    // Wait for postgres health
    let _ = app.emit("setup-step", "Waiting for database...");
    tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;

    let _ = app.emit("setup-step", "Running setup (migrations + admin account)...");
    run_setup(&d, cfg).await?;

    let _ = app.emit("setup-step", "Starting API server...");
    start_api(&d, cfg).await?;

    let _ = app.emit("setup-step", "Starting web server...");
    start_web(&d).await?;

    let _ = app.emit("setup-step", "Starting Caddy (reverse proxy)...");
    start_caddy(&d, cfg).await?;

    let _ = app.emit("setup-step", "Ready!");

    Ok(())
}

pub async fn start_instance_quick(app: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let _cfg = config::load_config()?;
    let d = docker()?;

    // Just start existing containers
    for name in &["gratonite-postgres", "gratonite-redis", "gratonite-api", "gratonite-web", "gratonite-caddy"] {
        let _ = d.start_container(*name, None::<StartContainerOptions<String>>).await;
    }

    let _ = app.emit("setup-step", "Started!");
    Ok(())
}

pub async fn stop_instance() -> Result<(), Box<dyn std::error::Error>> {
    let d = docker()?;

    for name in &["gratonite-caddy", "gratonite-web", "gratonite-api", "gratonite-setup", "gratonite-redis", "gratonite-postgres"] {
        let _ = d.stop_container(*name, Some(StopContainerOptions { t: 10 })).await;
    }

    Ok(())
}

pub async fn get_logs(service: &str, lines: u64) -> Result<Vec<String>, Box<dyn std::error::Error>> {
    let d = docker()?;
    let container_name = format!("gratonite-{}", service);

    let mut logs = d.logs(
        &container_name,
        Some(LogsOptions::<String> {
            stdout: true,
            stderr: true,
            tail: lines.to_string(),
            ..Default::default()
        }),
    );

    let mut result = Vec::new();
    while let Some(Ok(log)) = logs.next().await {
        result.push(format!("{}", log));
    }

    Ok(result)
}

// --- Internal helpers ---

async fn ensure_network(d: &Docker) -> Result<(), Box<dyn std::error::Error>> {
    let _ = d.create_network(CreateNetworkOptions {
        name: NETWORK_NAME,
        ..Default::default()
    }).await;
    Ok(())
}

async fn ensure_volumes(d: &Docker) -> Result<(), Box<dyn std::error::Error>> {
    // Match docker-compose volume names (project name "gratonite" + underscore prefix)
    for vol in &["gratonite_postgres-data", "gratonite_redis-data", "gratonite_instance-keys", "gratonite_uploads", "gratonite_caddy-data", "gratonite_caddy-config"] {
        let _ = d.create_volume(CreateVolumeOptions {
            name: *vol,
            ..Default::default()
        }).await;
    }
    Ok(())
}

fn labels() -> HashMap<String, String> {
    let mut l = HashMap::new();
    l.insert("com.gratonite.server".into(), "true".into());
    l
}

fn port_map(container_port: &str, host_port: &str) -> PortMap {
    let mut map = PortMap::new();
    map.insert(
        container_port.to_string(),
        Some(vec![PortBinding {
            host_ip: Some("0.0.0.0".into()),
            host_port: Some(host_port.into()),
        }]),
    );
    map
}

async fn create_and_start(
    d: &Docker,
    name: &str,
    config: Config<String>,
) -> Result<(), Box<dyn std::error::Error>> {
    // Remove existing container if any
    let _ = d.remove_container(name, Some(RemoveContainerOptions { force: true, ..Default::default() })).await;

    d.create_container(
        Some(CreateContainerOptions { name, ..Default::default() }),
        config,
    ).await?;

    d.start_container(name, None::<StartContainerOptions<String>>).await?;
    Ok(())
}

async fn start_postgres(d: &Docker, cfg: &InstanceConfig) -> Result<(), Box<dyn std::error::Error>> {
    create_and_start(d, "gratonite-postgres", Config {
        image: Some("postgres:16-alpine".into()),
        env: Some(vec![
            format!("POSTGRES_USER={}", cfg.db_user),
            format!("POSTGRES_PASSWORD={}", cfg.db_password),
            format!("POSTGRES_DB={}", cfg.db_name),
        ]),
        labels: Some(labels()),
        host_config: Some(HostConfig {
            mounts: Some(vec![Mount {
                target: Some("/var/lib/postgresql/data".into()),
                source: Some("gratonite_postgres-data".into()),
                typ: Some(MountTypeEnum::VOLUME),
                ..Default::default()
            }]),
            network_mode: Some(NETWORK_NAME.into()),
            ..Default::default()
        }),
        ..Default::default()
    }).await
}

async fn start_redis(d: &Docker) -> Result<(), Box<dyn std::error::Error>> {
    create_and_start(d, "gratonite-redis", Config {
        image: Some("redis:7-alpine".into()),
        cmd: Some(vec!["redis-server".into(), "--maxmemory".into(), "256mb".into(), "--maxmemory-policy".into(), "noeviction".into()]),
        labels: Some(labels()),
        host_config: Some(HostConfig {
            mounts: Some(vec![Mount {
                target: Some("/data".into()),
                source: Some("gratonite_redis-data".into()),
                typ: Some(MountTypeEnum::VOLUME),
                ..Default::default()
            }]),
            network_mode: Some(NETWORK_NAME.into()),
            ..Default::default()
        }),
        ..Default::default()
    }).await
}

async fn run_setup(d: &Docker, cfg: &InstanceConfig) -> Result<(), Box<dyn std::error::Error>> {
    let db_url = format!(
        "postgresql://{}:{}@gratonite-postgres:5432/{}",
        cfg.db_user, cfg.db_password, cfg.db_name
    );

    // Remove old setup container
    let _ = d.remove_container("gratonite-setup", Some(RemoveContainerOptions { force: true, ..Default::default() })).await;

    d.create_container(
        Some(CreateContainerOptions { name: "gratonite-setup", ..Default::default() }),
        Config {
            image: Some("ghcr.io/coodayea/gratonite-setup:latest".into()),
            env: Some(vec![
                format!("DATABASE_URL={}", db_url),
                "REDIS_URL=redis://gratonite-redis:6379".into(),
                format!("INSTANCE_DOMAIN={}", cfg.domain),
                format!("ADMIN_EMAIL={}", cfg.admin_email),
                format!("ADMIN_USERNAME=admin"),
                format!("ADMIN_PASSWORD={}", cfg.admin_password),
                format!("JWT_SECRET={}", cfg.jwt_secret),
                format!("JWT_REFRESH_SECRET={}", cfg.jwt_refresh_secret),
                format!("MFA_ENCRYPTION_KEY={}", cfg.mfa_encryption_key),
            ]),
            labels: Some(labels()),
            host_config: Some(HostConfig {
                mounts: Some(vec![Mount {
                    target: Some("/app/keys".into()),
                    source: Some("gratonite_instance-keys".into()),
                    typ: Some(MountTypeEnum::VOLUME),
                    ..Default::default()
                }]),
                network_mode: Some(NETWORK_NAME.into()),
                ..Default::default()
            }),
                ..Default::default()
        },
    ).await?;

    d.start_container("gratonite-setup", None::<StartContainerOptions<String>>).await?;

    // Wait for setup to complete (max 60s)
    for _ in 0..30 {
        tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
        let info = d.inspect_container("gratonite-setup", None).await?;
        if let Some(state) = info.state {
            if state.running == Some(false) {
                let exit_code = state.exit_code.unwrap_or(-1);
                if exit_code != 0 {
                    return Err(format!("Setup failed with exit code {}", exit_code).into());
                }
                return Ok(());
            }
        }
    }

    Err("Setup timed out".into())
}

async fn start_api(d: &Docker, cfg: &InstanceConfig) -> Result<(), Box<dyn std::error::Error>> {
    let db_url = format!(
        "postgresql://{}:{}@gratonite-postgres:5432/{}",
        cfg.db_user, cfg.db_password, cfg.db_name
    );

    create_and_start(d, "gratonite-api", Config {
        image: Some("ghcr.io/coodayea/gratonite-api:latest".into()),
        env: Some(vec![
            format!("DATABASE_URL={}", db_url),
            "REDIS_URL=redis://gratonite-redis:6379".into(),
            "PORT=4000".into(),
            "NODE_ENV=production".into(),
            format!("INSTANCE_DOMAIN={}", cfg.domain),
            format!("JWT_SECRET={}", cfg.jwt_secret),
            format!("JWT_REFRESH_SECRET={}", cfg.jwt_refresh_secret),
            format!("MFA_ENCRYPTION_KEY={}", cfg.mfa_encryption_key),
            "FEDERATION_ENABLED=true".into(),
            "FEDERATION_ALLOW_INBOUND=true".into(),
            "FEDERATION_ALLOW_OUTBOUND=true".into(),
            "FEDERATION_ALLOW_JOINS=true".into(),
            "FEDERATION_HUB_URL=https://gratonite.chat".into(),
            "RELAY_ENABLED=true".into(),
            "RELAY_URL=wss://relay.gratonite.chat".into(),
        ]),
        labels: Some(labels()),
        host_config: Some(HostConfig {
            mounts: Some(vec![
                Mount {
                    target: Some("/app/keys".into()),
                    source: Some("gratonite_instance-keys".into()),
                    typ: Some(MountTypeEnum::VOLUME),
                    ..Default::default()
                },
                Mount {
                    target: Some("/app/uploads".into()),
                    source: Some("gratonite_uploads".into()),
                    typ: Some(MountTypeEnum::VOLUME),
                    ..Default::default()
                },
            ]),
            network_mode: Some(NETWORK_NAME.into()),
            restart_policy: Some(bollard::models::RestartPolicy {
                name: Some(bollard::models::RestartPolicyNameEnum::UNLESS_STOPPED),
                ..Default::default()
            }),
            ..Default::default()
        }),
        ..Default::default()
    }).await
}

async fn start_web(d: &Docker) -> Result<(), Box<dyn std::error::Error>> {
    create_and_start(d, "gratonite-web", Config {
        image: Some("ghcr.io/coodayea/gratonite-web:latest".into()),
        labels: Some(labels()),
        host_config: Some(HostConfig {
            network_mode: Some(NETWORK_NAME.into()),
            restart_policy: Some(bollard::models::RestartPolicy {
                name: Some(bollard::models::RestartPolicyNameEnum::UNLESS_STOPPED),
                ..Default::default()
            }),
            ..Default::default()
        }),
        ..Default::default()
    }).await
}

async fn start_caddy(d: &Docker, _cfg: &InstanceConfig) -> Result<(), Box<dyn std::error::Error>> {
    // Write Caddyfile content as a config label (Caddy can read from env)
    let caddyfile = format!(
        r#"localhost {{
    handle /api/* {{
        reverse_proxy gratonite-api:4000
    }}
    handle /socket.io/* {{
        reverse_proxy gratonite-api:4000
    }}
    handle /health {{
        reverse_proxy gratonite-api:4000
    }}
    handle /.well-known/gratonite {{
        reverse_proxy gratonite-api:4000
    }}
    handle /uploads/* {{
        reverse_proxy gratonite-api:4000
    }}
    handle {{
        reverse_proxy gratonite-web:80
    }}
    tls internal
    header {{
        X-Content-Type-Options nosniff
        X-Frame-Options DENY
        Referrer-Policy strict-origin-when-cross-origin
        -Server
    }}
    encode gzip
}}"#
    );

    // Write Caddyfile to a temp volume
    let caddyfile_b64 = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, caddyfile.as_bytes());

    create_and_start(d, "gratonite-caddy", Config {
        image: Some("caddy:2-alpine".into()),
        cmd: Some(vec![
            "sh".into(), "-c".into(),
            format!("echo '{}' | base64 -d > /etc/caddy/Caddyfile && caddy run --config /etc/caddy/Caddyfile", caddyfile_b64),
        ]),
        labels: Some(labels()),
        exposed_ports: Some({
            let mut p = HashMap::new();
            p.insert("443/tcp".into(), HashMap::new());
            p.insert("80/tcp".into(), HashMap::new());
            p
        }),
        host_config: Some(HostConfig {
            port_bindings: Some({
                let mut m = port_map("443/tcp", "8443");
                m.extend(port_map("80/tcp", "8080"));
                m
            }),
            mounts: Some(vec![
                Mount {
                    target: Some("/data".into()),
                    source: Some("gratonite_caddy-data".into()),
                    typ: Some(MountTypeEnum::VOLUME),
                    ..Default::default()
                },
                Mount {
                    target: Some("/config".into()),
                    source: Some("gratonite_caddy-config".into()),
                    typ: Some(MountTypeEnum::VOLUME),
                    ..Default::default()
                },
            ]),
            network_mode: Some(NETWORK_NAME.into()),
            restart_policy: Some(bollard::models::RestartPolicy {
                name: Some(bollard::models::RestartPolicyNameEnum::UNLESS_STOPPED),
                ..Default::default()
            }),
            ..Default::default()
        }),
        ..Default::default()
    }).await
}
