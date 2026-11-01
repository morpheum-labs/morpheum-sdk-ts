use std::sync::{Arc, Mutex};

use async_trait::async_trait;
use morpheum_sdk_core::prelude::TxBuilder;
use morpheum_sdk_core::proto::google::protobuf::Any as ProtoAny;
use morpheum_sdk_core::signing::proto::tx::v1::{Nonce, SignDoc, SignMode};
use morpheum_sdk_core::signing::signer::Signer;
use morpheum_sdk_core::signing::types::{PublicKey, Signature, WalletType};
use morpheum_sdk_core::signing::SigningError;
use morpheum_sdk_position::{ClosePositionRequest, UpdatePositionLeverageRequest};
use prost::Message;
use serde::Serialize;

const RUST_SDK: &str = "/tmp/morpheum-sdk";
const RUST_SDK_REPO: &str = "https://github.com/morpheum-labs/morpheum-sdk";
const GENERATING_COMMAND: &str = "RUSTUP_TOOLCHAIN=1.91.0 cargo run --quiet --manifest-path test/fixtures/parity/gen/Cargo.toml > test/fixtures/parity/signdocs.json";

const SIGNER: &str = "0x1111111111111111111111111111111111111111";
const ADDRESS: [u8; 20] = [0x11; 20];
const CHAIN_ID: &str = "morm-dev-1";
const GENESIS: [u8; 32] = [7; 32];
const NONCE: (u64, u32, u32) = (0, 1_234_567, 0);

// Fixture names are the TypeScript enum keys for WalletType::Evm and SignMode::Eip191Personal.
const CHAIN_TYPE: &str = "ETHEREUM";
const SIGN_MODE: &str = "EIP191_PERSONAL";

struct Case {
    name: &'static str,
    rust_call: &'static str,
    note: Option<&'static str>,
    any: ProtoAny,
}

/// `rust_call` is `stringify!` of the request expression, so the fixture
/// records the call that produced the bytes.
macro_rules! case {
    ($name:literal, $req:expr) => {
        Case {
            name: $name,
            rust_call: stringify!($req),
            note: None,
            any: $req.to_any(),
        }
    };
    ($name:literal, $req:expr, note = $note:literal) => {
        Case {
            name: $name,
            rust_call: stringify!($req),
            note: Some($note),
            any: $req.to_any(),
        }
    };
}

fn cases() -> Vec<Case> {
    vec![
        case!("position-close", ClosePositionRequest::new(SIGNER, 0, 100)),
        case!(
            "position-update-leverage",
            UpdatePositionLeverageRequest::new(SIGNER, 1, "5")
                .with_position_id("3")
                .with_bucket_id("7")
        ),
    ]
}

struct SignDocRecorder {
    sign_doc: Arc<Mutex<Option<Vec<u8>>>>,
}

#[async_trait]
impl Signer for SignDocRecorder {
    async fn sign(&self, sign_doc: &SignDoc) -> Result<Signature, SigningError> {
        *self.sign_doc.lock().expect("sign doc lock") = Some(sign_doc.encode_to_vec());
        Ok(Signature::Secp256k1([0u8; 64]))
    }

    fn public_key(&self) -> PublicKey {
        PublicKey::EvmAddress(ADDRESS)
    }

    fn wallet_type(&self) -> WalletType {
        WalletType::Evm
    }

    fn sign_mode(&self) -> SignMode {
        SignMode::Eip191Personal
    }
}

fn hex(bytes: &[u8]) -> String {
    const DIGITS: &[u8; 16] = b"0123456789abcdef";
    let mut out = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        out.push(DIGITS[(byte >> 4) as usize] as char);
        out.push(DIGITS[(byte & 0x0f) as usize] as char);
    }
    out
}

async fn sign_doc(any: ProtoAny) -> Vec<u8> {
    let captured = Arc::new(Mutex::new(None));
    let signer = SignDocRecorder {
        sign_doc: Arc::clone(&captured),
    };
    TxBuilder::new(signer)
        .chain_id(CHAIN_ID)
        .with_genesis_hash(GENESIS.to_vec())
        .memo("")
        .with_nonce(Nonce {
            monotonic: NONCE.0,
            ts_ms: NONCE.1,
            sub: NONCE.2,
        })
        .add_message(any)
        .sign()
        .await
        .expect("sign");
    let bytes = captured
        .lock()
        .expect("sign doc lock")
        .take()
        .expect("signer saw a SignDoc");
    bytes
}

fn rust_sdk_sha() -> String {
    let output = std::process::Command::new("git")
        .args(["-C", RUST_SDK, "rev-parse", "HEAD"])
        .output()
        .expect("git rev-parse");
    if !output.status.success() {
        panic!(
            "git rev-parse failed: {}",
            String::from_utf8_lossy(&output.stderr)
        );
    }
    String::from_utf8(output.stdout)
        .expect("sha utf8")
        .trim()
        .to_string()
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FixtureOut {
    rust_sdk_repo: &'static str,
    rust_sdk_sha: String,
    generating_command: &'static str,
    envelope: EnvelopeOut,
    cases: Vec<CaseOut>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct EnvelopeOut {
    signer: &'static str,
    chain_type: &'static str,
    sign_mode: &'static str,
    chain_id: &'static str,
    memo: &'static str,
    genesis_hash_hex: String,
    nonce: NonceOut,
    gas_limit: Option<u64>,
    account_number: &'static str,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct NonceOut {
    monotonic: String,
    ts_ms: u32,
    sub: u32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CaseOut {
    name: &'static str,
    rust_call: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    note: Option<&'static str>,
    msg_hex: String,
    sign_doc_hex: String,
}

fn envelope() -> EnvelopeOut {
    EnvelopeOut {
        signer: SIGNER,
        chain_type: CHAIN_TYPE,
        sign_mode: SIGN_MODE,
        chain_id: CHAIN_ID,
        memo: "",
        genesis_hash_hex: hex(&GENESIS),
        nonce: NonceOut {
            monotonic: NONCE.0.to_string(),
            ts_ms: NONCE.1,
            sub: NONCE.2,
        },
        gas_limit: None,
        account_number: "0",
    }
}

async fn emit(case: Case) -> CaseOut {
    let msg_hex = hex(&case.any.value);
    let sign_doc_hex = hex(&sign_doc(case.any).await);
    CaseOut {
        name: case.name,
        rust_call: case.rust_call,
        note: case.note,
        msg_hex,
        sign_doc_hex,
    }
}

fn main() {
    let runtime = tokio::runtime::Builder::new_current_thread()
        .build()
        .expect("runtime");
    let cases = runtime.block_on(async {
        let mut out = Vec::new();
        for case in cases() {
            out.push(emit(case).await);
        }
        out
    });
    let fixture = FixtureOut {
        rust_sdk_repo: RUST_SDK_REPO,
        rust_sdk_sha: rust_sdk_sha(),
        generating_command: GENERATING_COMMAND,
        envelope: envelope(),
        cases,
    };
    println!("{}", serde_json::to_string_pretty(&fixture).expect("json"));
}
