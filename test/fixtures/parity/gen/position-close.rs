use std::sync::{Arc, Mutex};

use async_trait::async_trait;
use morpheum_sdk_core::prelude::TxBuilder;
use morpheum_sdk_core::signing::proto::tx::v1::{Nonce, SignDoc, SignMode};
use morpheum_sdk_core::signing::signer::Signer;
use morpheum_sdk_core::signing::types::{PublicKey, Signature, WalletType};
use morpheum_sdk_core::signing::SigningError;
use morpheum_sdk_position::ClosePositionRequest;
use prost::Message;

const SIGNER: &str = "0x1111111111111111111111111111111111111111";
const ADDRESS: [u8; 20] = [0x11; 20];

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

fn main() {
    let runtime = tokio::runtime::Builder::new_current_thread()
        .build()
        .expect("runtime");
    runtime.block_on(run());
}

async fn run() {
    let request = ClosePositionRequest::new(SIGNER, 0, 100);
    let any = request.to_any();
    let msg_hex = hex(&any.value);

    let captured = Arc::new(Mutex::new(None));
    let signer = SignDocRecorder {
        sign_doc: Arc::clone(&captured),
    };
    TxBuilder::new(signer)
        .chain_id("morm-dev-1")
        .with_genesis_hash(vec![7u8; 32])
        .memo("")
        .with_nonce(Nonce {
            monotonic: 0,
            ts_ms: 1_234_567,
            sub: 0,
        })
        .add_message(any)
        .sign()
        .await
        .expect("sign");

    let sign_doc = captured
        .lock()
        .expect("sign doc lock")
        .clone()
        .expect("signer saw a SignDoc");
    println!("msgHex={}", msg_hex);
    println!("msgLen={}", msg_hex.len() / 2);
    println!("signDocHex={}", hex(&sign_doc));
    println!("signDocLen={}", sign_doc.len());
}
