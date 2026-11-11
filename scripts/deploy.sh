#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# Nkonyeni Golf Tour — GCP Cloud Run deploy script
# Usage:
#   ./scripts/deploy.sh                   # interactive, prompts for secrets
#   ./scripts/deploy.sh --auto            # non-interactive, reads ./deploy.env
#   ./scripts/deploy.sh --dry-run         # print what would happen
#   ./scripts/deploy.sh --help            # this message
#
# Prerequisites:
#   gcloud CLI — authenticated as bobjana@gmail.com
#   Billing enabled on the nkonyeni-golftour project
#   Cloud SQL instance golftour-pg in africa-south1 (attached below)
#
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail
shopt -s inherit_errexit
cd "$(dirname "$0")/.."

APP="nkonyeni-golftour"
REGION="africa-south1"
PROJECT="$APP"
SQL_INSTANCE="golftour-pg"

# ── helpers ──────────────────────────────────────────────────────────────────
die() { echo "$*" >&2; exit 1; }
info() { printf "\033[36m➜\033[m %s\n" "$*"; }
ok()   { printf "\033[32m✔\033[m %s\n" "$*"; }
warn() { printf "\033[33m⚠\033[m %s\n" "$*"; }

usage() {
  sed -n 's/^# //p; /^$/q' "$0"
  exit 0
}

# ── parse flags ──────────────────────────────────────────────────────────────
AUTO=false
DRY_RUN=false
for arg; do
  case "$arg" in
    --help)    usage ;;
    --auto)    AUTO=true ;;
    --dry-run) DRY_RUN=true ;;
    *)         die "Unknown flag: $arg" ;;
  esac
done

# ── step 1: verify gcloud ───────────────────────────────────────────────────
info "Checking gcloud authentication …"
ACTIVE_ACCT=$(gcloud auth list --format=json 2>/dev/null | \
  python3 -c "import sys,json; accounts=json.load(sys.stdin); print([a['account'] for a in accounts if a['status']=='ACTIVE'][0] if any(a['status']=='ACTIVE' for a in accounts) else '')" 2>/dev/null || true)
if [[ -z "$ACTIVE_ACCT" ]]; then
  warn "No active gcloud account.  Run:  gcloud auth login"
  $AUTO && die "Cannot continue without auth." || true
fi
ok "Active account: ${ACTIVE_ACCT:-bobjana@gmail.com}"

info "Checking project …"
CUR_PROJECT=$(gcloud config get project 2>/dev/null || echo "")
if [[ "$CUR_PROJECT" != "$PROJECT" ]]; then
  gcloud config set project "$PROJECT"
  info "Set project to $PROJECT"
fi

# ── step 2: collect secrets ─────────────────────────────────────────────────
if $DRY_RUN; then
  :  # skip prompts — use placeholder values for the dry-run output
elif $AUTO; then
  [[ -f deploy.env ]] || die "deploy.env not found (needed for --auto)"
  # shellcheck disable=1091
  source deploy.env
else
  echo ""
  echo "╔══════════════════════════════════════════════════════════════╗"
  echo "║   Provide environment variables for Cloud Run              ║"
  echo "║   (leave blank to skip; deployment will fail without them) ║"
  echo "╚══════════════════════════════════════════════════════════════╝"
  read -r -p "DATABASE_URL  (Neon): "       DATABASE_URL
  read -r -s -p "SESSION_SECRET (32+ chars): " SESSION_SECRET; echo ""
  read -r -p "APP_URL       (public URL): " APP_URL
  read -r -p "DEMO_DISABLED (1 = hide Demo tab, blank = keep): " DEMO_DISABLED
fi

# ── step 3: build env-vars file ──────────────────────────────────────────────
# Set defaults for dry-run (no prompts)
DATABASE_URL="${DATABASE_URL:-}"
SESSION_SECRET="${SESSION_SECRET:-}"
APP_URL="${APP_URL:-}"
DEMO_DISABLED="${DEMO_DISABLED:-}"

ENV_VARS=()
add_var() {
  local name="$1" val="${2:-}"
  [[ -n "$val" ]] && ENV_VARS+=("${name}=${val}") || true
}

add_var NODE_ENV            production
add_var DATABASE_URL        "$DATABASE_URL"
add_var SESSION_SECRET      "$SESSION_SECRET"
add_var APP_URL             "$APP_URL"
add_var DEMO_DISABLED       "$DEMO_DISABLED"


# Write env vars as YAML for gcloud
ENV_VARS_FILE=$(mktemp)
trap 'rm -f "$ENV_VARS_FILE"' EXIT
{
  for pair in "${ENV_VARS[@]}"; do
    key="${pair%%=*}"
    val="${pair#*=}"
    # YAML double-quoted to handle special chars (colons, hashes, etc.)
    escaped_val="${val//\\/\\\\}"
    escaped_val="${escaped_val//\"/\\\"}"
    printf '%s: "%s"\n' "$key" "$escaped_val"
  done
} > "$ENV_VARS_FILE"

if $DRY_RUN; then
  info "── dry-run ────────────────────────────────────────────────────"
  echo "gcloud run deploy $APP \\"
  echo "  --region=$REGION --source=. --concurrency=80 \\"
  echo "  --min-instances=0 --max-instances=10 --ingress=all \\"
  echo "  --add-cloudsql-instances=$PROJECT:$REGION:$SQL_INSTANCE \\"
  echo "  --env-vars-file=<env.yaml>"
  echo ""
  echo "Env vars being set:"
  for pair in "${ENV_VARS[@]}"; do
    echo "  ${pair%%=*}=…"
  done
  echo ""
  echo "Project:      $PROJECT"
  echo "Region:       $REGION"
  echo "Service:      $APP"
  echo "Dockerfile:   Dockerfile"
  echo ""
  echo "To deploy:    just deploy   (interactive)"
  echo "              just deploy-auto   (from deploy.env)"
  exit 0
fi

# ── step 4: deploy — build from source and deploy to Cloud Run ───────────────
info "Deploying $APP to Cloud Run ($REGION) …"
gcloud run deploy "$APP" \
  --region="$REGION" \
  --source="." \
  --no-automatic-updates \
  --concurrency=80 \
  --min-instances=0 \
  --max-instances=10 \
  --ingress=all \
  --add-cloudsql-instances="$PROJECT:$REGION:$SQL_INSTANCE" \
  --env-vars-file="$ENV_VARS_FILE"

ok "Deploy complete!"