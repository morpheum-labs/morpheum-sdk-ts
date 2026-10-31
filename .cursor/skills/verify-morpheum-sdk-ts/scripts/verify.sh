#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
SKILL_DIR=$(cd "$SCRIPT_DIR/.." && pwd)
REPO=$(git -C "$SKILL_DIR" rev-parse --show-toplevel)
PARENT=$(cd "$REPO/.." && pwd)
EVIDENCE_ROOT="$SKILL_DIR/evidence"
LOCK=/tmp/verify-morpheum-sdk-ts-launch.lock
PROTO="$PARENT/morpheum-proto"
SIGNING="$PARENT/morpheum-signing"
PKG_NODE="$SIGNING/crates/wasm/pkg-node"

usage() {
  cat <<EOF
Usage: verify.sh <launch|doctor|drive|cleanup|features> [feature|RUN_ID]

  launch              install deps and import src/index.ts
  doctor              read-only check that this checkout is worth driving
  drive <feature>     run one mapped feature and write evidence/<feature>/proof.json
  cleanup [RUN_ID]    delete /tmp/verify-morpheum-sdk-ts-<RUN_ID>. Keeps evidence/
  features            print feature ids, one per line

Env:
  RUN_ID              scratch directory suffix. Default is a UTC timestamp.
  MORPHEUM_GRPC_URL   required only for grpc-query-client
  MORPHEUM_WS_URL     required only for ws-stream
EOF
}

run_id() {
  if [ -n "${RUN_ID:-}" ]; then
    printf '%s\n' "$RUN_ID"
    return
  fi
  date -u +%Y%m%dT%H%M%SZ
}

check_run_id() {
  local id=$1
  if [[ ! "$id" =~ ^[A-Za-z0-9._-]+$ ]]; then
    echo "RUN_ID must match [A-Za-z0-9._-]+" >&2
    exit 1
  fi
}

scratch_for() {
  printf '/tmp/verify-morpheum-sdk-ts-%s\n' "$1"
}

lock_held_by_live_pid() {
  local pid
  [ -d "$LOCK" ] || return 1
  pid=$(cat "$LOCK/pid" 2>/dev/null || true)
  [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null
}

acquire_lock() {
  if mkdir "$LOCK" 2>/dev/null; then
    echo $$ >"$LOCK/pid"
    return
  fi
  if lock_held_by_live_pid; then
    echo "launch already running as pid $(cat "$LOCK/pid")" >&2
    exit 1
  fi
  echo "removing stale launch lock" >&2
  rm -rf "$LOCK"
  mkdir "$LOCK"
  echo $$ >"$LOCK/pid"
}

release_lock() {
  rm -rf "$LOCK"
}

clone_missing() {
  local dest=$1 url=$2
  if [ -d "$dest/.git" ]; then
    echo "sibling present $dest"
    return 0
  fi
  if [ -e "$dest" ]; then
    echo "path exists and is not a git checkout: $dest" >&2
    return 1
  fi
  if [ ! -w "$PARENT" ]; then
    echo "parent directory is not writable: $PARENT" >&2
    echo "clone $url to $dest" >&2
    return 1
  fi
  echo "cloning $url"
  if ! GIT_TERMINAL_PROMPT=0 git clone --depth 1 "$url" "$dest"; then
    rm -rf "$dest"
    echo "clone failed: $url" >&2
    echo "morpheum-proto, morpheum-primitives, and cryptogram are private. GitHub answers Repository not found when the credential cannot read them." >&2
    return 1
  fi
}

ensure_proto_deps() {
  local proto_ts="$PROTO/ts"
  if [ ! -f "$proto_ts/package-lock.json" ]; then
    echo "morpheum-proto/ts/package-lock.json is missing under $PROTO" >&2
    echo "Generated files import @bufbuild/protobuf from that package. npm ci installs it beside the sources so Node and tsc can resolve it." >&2
    exit 1
  fi
  echo "npm ci proto"
  (cd "$proto_ts" && npm ci --ignore-scripts)
}

ensure_pkg_node() {
  if [ -f "$PKG_NODE/package.json" ]; then
    return 0
  fi
  for sibling in morpheum-proto morpheum-primitives cryptogram; do
    if [ ! -d "$PARENT/$sibling" ]; then
      echo "pkg-node is missing and $PARENT/$sibling is not checked out." >&2
      echo "wasm-pack build needs those siblings beside morpheum-signing." >&2
      echo "git clone https://github.com/morpheum-labs/$sibling.git $PARENT/$sibling" >&2
      exit 1
    fi
  done
  if ! command -v wasm-pack >/dev/null 2>&1; then
    echo "wasm-pack is not on PATH. Install it, then rerun launch." >&2
    echo "The signing repo builds the package this SDK imports with:" >&2
    echo "  wasm-pack build crates/wasm --target nodejs --out-dir pkg-node" >&2
    exit 1
  fi
  echo "building pkg-node"
  (cd "$SIGNING" && wasm-pack build crates/wasm --target nodejs --out-dir pkg-node)
}

cmd_launch() {
  acquire_lock
  trap release_lock EXIT
  local failed=0
  clone_missing "$PROTO" "https://github.com/morpheum-labs/morpheum-proto.git" || failed=1
  clone_missing "$SIGNING" "https://github.com/morpheum-labs/morpheum-signing.git" || failed=1
  if [ "$failed" -ne 0 ]; then
    exit 1
  fi
  if [ ! -f "$PROTO/ts/package.json" ]; then
    echo "morpheum-proto/ts/package.json is missing under $PROTO" >&2
    exit 1
  fi
  ensure_pkg_node
  ensure_proto_deps
  echo "npm install"
  (cd "$REPO" && npm install)
  echo "importing src/index.ts"
  # tsx --eval compiles as CommonJS unless --input-type=module. Top-level await
  # then fails before the barrel loads.
  (cd "$REPO" && ./node_modules/.bin/tsx --input-type=module --eval 'await import("./src/index.ts")')
  echo "verify-morpheum-sdk-ts ready"
}

cmd_features() {
  if [ ! -x "$REPO/node_modules/.bin/tsx" ]; then
    echo "tsx is missing. Run launch first." >&2
    exit 1
  fi
  (cd "$REPO" && ./node_modules/.bin/tsx "$SCRIPT_DIR/drive.ts" --list)
}

cmd_doctor() {
  local failed=0
  note() { printf '%s\n' "$*"; }
  bad() { printf 'FAIL %s\n' "$*" >&2; failed=1; }

  if lock_held_by_live_pid; then
    echo "launch is running as pid $(cat "$LOCK/pid"). Wait for it to finish." >&2
    exit 2
  fi

  note "repo $REPO"
  note "node $(node -v)"
  node -e 'const major=Number(process.versions.node.split(".")[0]); if (major < 20) process.exit(1)' \
    || bad "node must be 20 or newer"

  local pkg_name
  pkg_name=$(node -e 'const fs=require("fs"); process.stdout.write(JSON.parse(fs.readFileSync(process.argv[1],"utf8")).name)' "$REPO/package.json")
  if [ "$pkg_name" = "@morpheum/sdk" ]; then
    note "package @morpheum/sdk"
  else
    bad "package.json name is $pkg_name"
  fi

  if [ -f "$PROTO/ts/package.json" ]; then
    local proto_name
    proto_name=$(node -e 'const fs=require("fs"); process.stdout.write(JSON.parse(fs.readFileSync(process.argv[1],"utf8")).name)' "$PROTO/ts/package.json")
    if [ "$proto_name" = "@morpheum/proto" ]; then
      note "proto $PROTO/ts"
    else
      bad "proto package name is $proto_name"
    fi
  else
    bad "missing $PROTO/ts/package.json"
  fi

  if [ -f "$PKG_NODE/package.json" ]; then
    note "pkg-node $PKG_NODE"
  else
    bad "missing $PKG_NODE/package.json"
  fi

  if [ -f "$REPO/node_modules/@morpheum/proto/package.json" ]; then
    note "linked @morpheum/proto"
  else
    bad "node_modules/@morpheum/proto is missing. Run launch."
  fi
  if [ -f "$REPO/node_modules/@morpheum/signing-node/package.json" ]; then
    note "linked @morpheum/signing-node"
  else
    bad "node_modules/@morpheum/signing-node is missing. Run launch."
  fi
  if [ -f "$REPO/node_modules/@morpheum/signing-node/package.json" ]; then
    # -H follows the file: symlink. Default find (-P) stays on the link and misses the wasm.
    if find -H "$REPO/node_modules/@morpheum/signing-node" -name '*_bg.wasm' -print -quit | grep -q .; then
      note "signing wasm present"
    else
      bad "signing package has no *_bg.wasm"
    fi
    if grep -R -q -F --include='*.js' --include='*.d.ts' --include='*.mjs' --include='*.cjs' \
      buildSignDocBytes "$REPO/node_modules/@morpheum/signing-node"; then
      note "buildSignDocBytes exported"
    else
      bad "buildSignDocBytes not found in @morpheum/signing-node"
    fi
  fi

  if [ -d "$REPO/node_modules" ]; then
    local versions
    versions=$(node --input-type=module <<EOF
import { spawnSync } from "node:child_process";
const run = spawnSync("npm", ["ls", "@bufbuild/protobuf", "--all", "--json"], { cwd: "$REPO", encoding: "utf8" });
let tree;
try { tree = JSON.parse(run.stdout || "{}"); } catch { process.stderr.write("npm ls JSON parse failed\n"); process.exit(1); }
const versions = new Set();
const walk = (name, node) => {
  if (!node || typeof node !== "object") return;
  if (name === "@bufbuild/protobuf" && node.version) versions.add(node.version);
  for (const [childName, child] of Object.entries(node.dependencies ?? {})) walk(childName, child);
};
walk(tree.name, tree);
if (versions.size !== 1) {
  process.stderr.write("protobuf versions: " + [...versions].join(", ") + "\n");
  process.exit(1);
}
process.stdout.write([...versions][0]);
EOF
    ) || failed=1
    if [ -n "${versions:-}" ]; then
      note "protobuf $versions"
    else
      bad "expected one @bufbuild/protobuf version"
    fi
  fi

  if [ -x "$REPO/node_modules/.bin/tsx" ]; then
    local ids files
    ids=$(cd "$REPO" && ./node_modules/.bin/tsx "$SCRIPT_DIR/drive.ts" --list | sort)
    files=$(find "$SKILL_DIR/features" -maxdepth 1 -name '*.md' ! -name 'README.md' -printf '%f\n' | sed 's/\.md$//' | sort)
    if [ "$ids" = "$files" ]; then
      note "feature map matches drive ids"
    else
      bad "feature files and drive ids differ"
      echo "drive ids:" >&2
      echo "$ids" >&2
      echo "feature files:" >&2
      echo "$files" >&2
    fi
    note "tsc --noEmit"
    if ! (cd "$REPO" && ./node_modules/.bin/tsc --noEmit -p tsconfig.json); then
      bad "tsc --noEmit failed"
    fi
  else
    bad "tsx is missing. Run launch."
  fi

  if [ -n "${MORPHEUM_GRPC_URL:-}" ]; then
    note "MORPHEUM_GRPC_URL set"
  else
    note "MORPHEUM_GRPC_URL unset (grpc-query-client will be UNMET)"
  fi
  if [ -n "${MORPHEUM_WS_URL:-}" ]; then
    note "MORPHEUM_WS_URL set"
  else
    note "MORPHEUM_WS_URL unset (ws-stream will be UNMET)"
  fi
  if node -e 'process.exit(typeof WebSocket === "function" ? 0 : 1)'; then
    note "global WebSocket present"
  else
    note "global WebSocket absent (ws-stream will fail on this Node)"
  fi

  if [ "$failed" -ne 0 ]; then
    echo "doctor fail" >&2
    exit 1
  fi
  echo "doctor ok"
}

cmd_drive() {
  local feature=${1:-}
  if [ -z "$feature" ]; then
    echo "drive needs a feature id. Run: verify.sh features" >&2
    exit 1
  fi
  if lock_held_by_live_pid; then
    echo "launch is running as pid $(cat "$LOCK/pid"). Wait for it to finish." >&2
    exit 2
  fi
  if [ ! -x "$REPO/node_modules/.bin/tsx" ]; then
    echo "tsx is missing. Run launch first." >&2
    exit 1
  fi
  local id scratch evidence transcript
  id=$(run_id)
  check_run_id "$id"
  scratch=$(scratch_for "$id")
  evidence="$EVIDENCE_ROOT/$feature"
  mkdir -p "$scratch" "$evidence"
  transcript="$evidence/transcript.txt"
  echo "scratch $scratch"
  echo "evidence $evidence/proof.json"
  set +e
  (
    cd "$REPO" && ./node_modules/.bin/tsx "$SCRIPT_DIR/drive.ts" \
      --feature "$feature" \
      --repo "$REPO" \
      --evidence "$evidence/proof.json" \
      --evidence-root "$EVIDENCE_ROOT" \
      --scratch "$scratch" \
      --run-id "$id" \
      --command "bash .cursor/skills/verify-morpheum-sdk-ts/scripts/verify.sh drive $feature"
  ) 2>&1 | tee "$transcript"
  local status=${PIPESTATUS[0]}
  set -e
  if [ "$status" -ne 0 ]; then
    exit "$status"
  fi
}

remove_scratch() {
  local scratch=$1
  case "$scratch" in
    /tmp/verify-morpheum-sdk-ts-*)
      if [ -d "$scratch" ]; then
        rm -rf "$scratch"
        echo "removed $scratch"
      else
        echo "scratch already absent $scratch"
      fi
      ;;
    *)
      echo "refusing to delete $scratch" >&2
      exit 1
      ;;
  esac
}

cmd_cleanup() {
  local id=${1:-${RUN_ID:-}}
  if [ -n "$id" ]; then
    check_run_id "$id"
    remove_scratch "$(scratch_for "$id")"
  else
    local match
    shopt -s nullglob
    for match in /tmp/verify-morpheum-sdk-ts-*; do
      if [ -d "$match" ]; then
        remove_scratch "$match"
      fi
    done
    shopt -u nullglob
  fi
  if lock_held_by_live_pid; then
    echo "launch lock still held by pid $(cat "$LOCK/pid")"
  elif [ -d "$LOCK" ]; then
    rm -rf "$LOCK"
    echo "removed stale launch lock"
  fi
  if [ -d "$EVIDENCE_ROOT" ]; then
    echo "evidence kept at $EVIDENCE_ROOT"
  else
    echo "evidence directory missing: $EVIDENCE_ROOT" >&2
    exit 1
  fi
}

main() {
  local cmd=${1:-}
  case "$cmd" in
    launch) cmd_launch ;;
    doctor) cmd_doctor ;;
    features) cmd_features ;;
    drive) shift; cmd_drive "${1:-}" ;;
    cleanup) shift; cmd_cleanup "${1:-}" ;;
    -h|--help|help|"") usage ;;
    *)
      echo "unknown command: $cmd" >&2
      usage >&2
      exit 1
      ;;
  esac
}

main "$@"
