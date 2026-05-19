//! OAuth helper commands for desktop browser flows.

use serde::{Deserialize, Serialize};
use specta::Type;
use std::{
    io::{Read, Write},
    net::TcpListener,
    time::Duration,
};
use tauri::AppHandle;
use tauri_plugin_opener::OpenerExt;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct OAuthLoopbackResult {
    pub code: String,
    pub state: Option<String>,
    pub redirect_uri: String,
}

#[tauri::command]
#[specta::specta]
pub async fn start_google_oauth_loopback(
    app: AppHandle,
    client_id: String,
    scope: String,
    state: String,
    code_challenge: String,
) -> Result<OAuthLoopbackResult, String> {
    if client_id.trim().is_empty() {
        return Err("Google OAuth client id is not configured".to_string());
    }

    if scope.trim().is_empty() {
        return Err("Google OAuth scope cannot be empty".to_string());
    }

    let listener = TcpListener::bind("127.0.0.1:0")
        .map_err(|e| format!("Failed to start OAuth callback listener: {e}"))?;
    listener
        .set_nonblocking(false)
        .map_err(|e| format!("Failed to configure OAuth callback listener: {e}"))?;

    let local_addr = listener
        .local_addr()
        .map_err(|e| format!("Failed to read OAuth callback address: {e}"))?;
    let redirect_uri = format!("http://127.0.0.1:{}/", local_addr.port());

    let auth_url = format!(
        "https://accounts.google.com/o/oauth2/v2/auth?client_id={}&redirect_uri={}&response_type=code&scope={}&state={}&code_challenge={}&code_challenge_method=S256&access_type=offline&prompt=consent",
        percent_encode(&client_id),
        percent_encode(&redirect_uri),
        percent_encode(&scope),
        percent_encode(&state),
        percent_encode(&code_challenge)
    );

    app.opener()
        .open_url(auth_url, None::<&str>)
        .map_err(|e| format!("Failed to open Google sign-in: {e}"))?;

    tauri::async_runtime::spawn_blocking(move || wait_for_oauth_callback(listener, redirect_uri))
        .await
        .map_err(|e| format!("OAuth callback task failed: {e}"))?
}

fn wait_for_oauth_callback(
    listener: TcpListener,
    redirect_uri: String,
) -> Result<OAuthLoopbackResult, String> {
    listener
        .set_ttl(64)
        .map_err(|e| format!("Failed to configure OAuth callback listener: {e}"))?;

    let (mut stream, _) = listener
        .accept()
        .map_err(|e| format!("Failed to accept OAuth callback: {e}"))?;
    stream
        .set_read_timeout(Some(Duration::from_secs(10)))
        .map_err(|e| format!("Failed to set OAuth callback timeout: {e}"))?;

    let mut buffer = [0_u8; 4096];
    let read = stream
        .read(&mut buffer)
        .map_err(|e| format!("Failed to read OAuth callback: {e}"))?;
    let request = String::from_utf8_lossy(&buffer[..read]);
    let request_line = request
        .lines()
        .next()
        .ok_or_else(|| "OAuth callback request was empty".to_string())?;
    let path = request_line
        .split_whitespace()
        .nth(1)
        .ok_or_else(|| "OAuth callback request path was missing".to_string())?;

    let query = path
        .split_once('?')
        .map(|(_, query)| query)
        .ok_or_else(|| "OAuth callback query was missing".to_string())?;

    let mut code = None;
    let mut state = None;
    let mut error = None;

    for pair in query.split('&') {
        let Some((key, value)) = pair.split_once('=') else {
            continue;
        };
        let decoded = percent_decode(value)?;
        match key {
            "code" => code = Some(decoded),
            "state" => state = Some(decoded),
            "error" => error = Some(decoded),
            _ => {}
        }
    }

    let response_body = if error.is_some() {
        "Google sign-in was cancelled. You can close this tab and return to Axis."
    } else {
        "Google sign-in complete. You can close this tab and return to Axis."
    };
    let response = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        response_body.len(),
        response_body
    );
    let _ = stream.write_all(response.as_bytes());
    let _ = stream.flush();

    if let Some(error) = error {
        return Err(format!("Google OAuth error: {error}"));
    }

    Ok(OAuthLoopbackResult {
        code: code.ok_or_else(|| "OAuth callback code was missing".to_string())?,
        state,
        redirect_uri,
    })
}

fn percent_encode(value: &str) -> String {
    let mut encoded = String::new();
    for byte in value.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'.' | b'_' | b'~' => {
                encoded.push(byte as char);
            }
            _ => encoded.push_str(&format!("%{byte:02X}")),
        }
    }
    encoded
}

fn percent_decode(value: &str) -> Result<String, String> {
    let mut bytes = Vec::with_capacity(value.len());
    let mut chars = value.as_bytes().iter().copied();

    while let Some(byte) = chars.next() {
        if byte == b'%' {
            let high = chars
                .next()
                .ok_or_else(|| "Invalid percent-encoded OAuth callback value".to_string())?;
            let low = chars
                .next()
                .ok_or_else(|| "Invalid percent-encoded OAuth callback value".to_string())?;
            let high = from_hex(high)?;
            let low = from_hex(low)?;
            bytes.push((high << 4) | low);
        } else if byte == b'+' {
            bytes.push(b' ');
        } else {
            bytes.push(byte);
        }
    }

    String::from_utf8(bytes).map_err(|e| format!("Invalid UTF-8 in OAuth callback value: {e}"))
}

fn from_hex(byte: u8) -> Result<u8, String> {
    match byte {
        b'0'..=b'9' => Ok(byte - b'0'),
        b'a'..=b'f' => Ok(byte - b'a' + 10),
        b'A'..=b'F' => Ok(byte - b'A' + 10),
        _ => Err("Invalid percent-encoded OAuth callback value".to_string()),
    }
}
