use reqwest::Client;
use serde::{Deserialize, Serialize};

const GITHUB_CLIENT_ID: &str = "Ov23liW8JJ1LJqr2fcRn";

#[derive(Deserialize)]
pub struct GitHubUser {
    pub login: String,
}

#[derive(Deserialize)]
pub struct GitHubRepo {
    pub name: String,
    pub clone_url: String,
}

/// Response from the Device Flow initiation endpoint.
#[derive(Deserialize, Serialize, Clone)]
pub struct DeviceFlowStart {
    pub device_code: String,
    pub user_code: String,
    pub verification_uri: String,
    pub expires_in: u64,
    pub interval: u64,
}

/// Initiates the GitHub Device Flow and returns codes the user needs to enter.
pub async fn start_device_flow() -> Result<DeviceFlowStart, String> {
    let client = Client::new();
    let res = client
        .post("https://github.com/login/device/code")
        .header("Accept", "application/json")
        .header("User-Agent", "NotizApp-Sync")
        .form(&[
            ("client_id", GITHUB_CLIENT_ID),
            ("scope", "repo"),
        ])
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if res.status().is_success() {
        let flow: DeviceFlowStart = res.json().await.map_err(|e| e.to_string())?;
        Ok(flow)
    } else {
        Err(format!("Failed to start device flow: {}", res.status()))
    }
}

/// Polls the GitHub token endpoint until the user approves or the code expires.
/// Returns the access token string on success.
pub async fn poll_device_flow(device_code: &str, interval_secs: u64) -> Result<String, String> {
    let client = Client::new();
    let wait = tokio::time::Duration::from_secs(interval_secs.max(5));
    // Max 12 minutes of polling (device codes expire in ~15 min)
    let max_attempts = 180 / interval_secs.max(5);

    for _ in 0..max_attempts {
        tokio::time::sleep(wait).await;

        let res = client
            .post("https://github.com/login/oauth/access_token")
            .header("Accept", "application/json")
            .header("User-Agent", "NotizApp-Sync")
            .form(&[
                ("client_id", GITHUB_CLIENT_ID),
                ("device_code", device_code),
                ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
            ])
            .send()
            .await
            .map_err(|e| e.to_string())?;

        let body: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;

        if let Some(token) = body.get("access_token").and_then(|v| v.as_str()) {
            return Ok(token.to_string());
        }

        let error = body.get("error").and_then(|v| v.as_str()).unwrap_or("");
        match error {
            "authorization_pending" => continue, // User hasn't approved yet
            "slow_down" => tokio::time::sleep(tokio::time::Duration::from_secs(5)).await,
            "expired_token" => return Err("Code expired. Please try again.".into()),
            "access_denied" => return Err("Access denied by user.".into()),
            _ if !error.is_empty() => return Err(format!("OAuth error: {}", error)),
            _ => continue,
        }
    }

    Err("Login timed out. Please try again.".into())
}

pub async fn verify_token(token: &str) -> Result<String, String> {
    let client = Client::new();
    let res = client
        .get("https://api.github.com/user")
        .header("Authorization", format!("Bearer {}", token))
        .header("User-Agent", "NotizApp-Sync")
        .header("Accept", "application/vnd.github.v3+json")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if res.status().is_success() {
        let user: GitHubUser = res.json().await.map_err(|e| e.to_string())?;
        Ok(user.login)
    } else {
        match res.text().await {
            Ok(err_text) => Err(format!("Invalid token or unauthorized: {}", err_text)),
            Err(_) => Err("Invalid token or unauthorized".to_string()),
        }
    }
}

pub async fn ensure_remote_repo(token: &str, username: &str) -> Result<String, String> {
    let client = Client::new();
    let repo_name = "NotizApp-Sync";
    
    let check_url = format!("https://api.github.com/repos/{}/{}", username, repo_name);
    let check_res = client
        .get(&check_url)
        .header("Authorization", format!("Bearer {}", token))
        .header("User-Agent", "NotizApp-Sync")
        .header("Accept", "application/vnd.github.v3+json")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if check_res.status().is_success() {
        let repo: GitHubRepo = check_res.json().await.map_err(|e| e.to_string())?;
        return Ok(repo.clone_url);
    }

    let create_url = "https://api.github.com/user/repos";
    let payload = serde_json::json!({
        "name": repo_name,
        "description": "Auto-sync repository for NotizApp",
        "private": true,
        "has_issues": false,
        "has_projects": false,
        "has_wiki": false
    });

    let create_res = client
        .post(create_url)
        .header("Authorization", format!("Bearer {}", token))
        .header("User-Agent", "NotizApp-Sync")
        .header("Accept", "application/vnd.github.v3+json")
        .json(&payload)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if create_res.status().is_success() || create_res.status() == reqwest::StatusCode::CREATED {
        let repo: GitHubRepo = create_res.json().await.map_err(|e| e.to_string())?;
        Ok(repo.clone_url)
    } else {
        let err_text = create_res.text().await.unwrap_or_default();
        Err(format!("Could not create remote repository {}: {}", repo_name, err_text))
    }
}
