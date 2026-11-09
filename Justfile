# ─── Nkonyeni Golf Tour ──────────────────────────────────────────────────────
# Justfile — common dev recipes
#   just          — list all recipes
#   just <recipe> — run a recipe

# ─── Default: show all recipes ───────────────────────────────────────────────

default:
    @just --list --justfile {{ justfile() }}

# ─── Package management ──────────────────────────────────────────────────────

# Install project dependencies
install:
    npm install

alias i := install

# Add a runtime dependency
add pkg:
    npm install {{ pkg }}

# Add a dev dependency
add-dev pkg:
    npm install --save-dev {{ pkg }}

# ─── Dev server ──────────────────────────────────────────────────────────────

# Start the Next.js dev server
dev:
    npm run dev

# ─── Build & start (production) ──────────────────────────────────────────────

# Build for production
build:
    npm run build

# Start the production server (run `build` first)
start:
    npm run start

# ─── Testing ─────────────────────────────────────────────────────────────────

# Run tests once
test:
    npm test

alias t := test

# Run tests in watch mode
test-watch:
    npm test -- --watch

alias tw := test-watch

# Run tests with coverage
test-coverage:
    npm test -- --coverage

alias tco := test-coverage

# Run a specific test file:  just test-file path/to/test.spec.ts
test-file f:
    npm test -- --run {{ f }}

# ─── Linting ─────────────────────────────────────────────────────────────────

# Lint all files
lint:
    npm run lint .

alias l := lint

# Lint and auto-fix
lint-fix:
    npm run lint -- --fix .

alias lf := lint-fix

# ─── Formatting ──────────────────────────────────────────────────────────────

# Format code with ESLint
format:
    npm run lint -- --fix .

alias fmt := format

# ─── Type checking ───────────────────────────────────────────────────────────

# Run TypeScript type checker
typecheck:
    npx tsc --noEmit

alias tc := typecheck

# ─── Database ────────────────────────────────────────────────────────────────

# Seed database. Pass flags like --demo, --reset, or both.
#   just seed             — plain seed
#   just seed --demo      — with demo scores
#   just seed --reset     — wipe then seed
seed flags="":
    npm run seed -- {{ flags }}

alias s := seed

# Seed with demo data (sample tour with played rounds)
seed-demo:
    npm run seed -- --demo

alias sd := seed-demo

# Reset and re-seed
seed-reset:
    npm run seed -- --reset

alias sr := seed-reset

# Full reset + demo
seed-reset-demo:
    npm run seed -- --reset --demo

alias srd := seed-reset-demo

# Remove local SQLite database
db-clean:
    rm -f data/local.db

# ─── Docker ──────────────────────────────────────────────────────────────────

# Build Docker image
docker-build:
    docker build -t nkonyeni-golftour .

# Build Docker image without cache
docker-build-nc:
    docker build --no-cache -t nkonyeni-golftour .

# ─── GCP / Cloud Run ─────────────────────────────────────────────────────────

# Deploy to Cloud Run (interactive — prompts for secrets)
deploy:
    ./scripts/deploy.sh

# Deploy to Cloud Run (non-interactive — reads deploy.env)
deploy-auto:
    ./scripts/deploy.sh --auto

# Deploy dry-run — show what would be sent without actually deploying
deploy-dry:
    ./scripts/deploy.sh --dry-run

# ─── Housekeeping ────────────────────────────────────────────────────────────

# Remove build artifacts and node_modules
clean:
    rm -rf .next out node_modules
    rm -f data/local.db
    rm -rf .*.tsbuildinfo

# Remove build artifacts only (keep node_modules)
clean-build:
    rm -rf .next out

# Reinstall dependencies from scratch
reinstall:
    rm -rf node_modules package-lock.json
    npm install

alias ri := reinstall

# ─── Pre-flight checks (CI) ──────────────────────────────────────────────────

# Run all checks: typecheck → lint → test
check:
    @echo "══════ typecheck ══════"
    npx tsc --noEmit
    @echo ""
    @echo "══════ lint ══════"
    npm run lint .
    @echo ""
    @echo "══════ test ══════"
    npm test

alias ci := check

# ─── Utility ─────────────────────────────────────────────────────────────────

# Show project version info
version:
    @echo "node  $(node --version 2>/dev/null || echo '?')"
    @echo "npm   $(npm --version 2>/dev/null || echo '?')"
    @echo "next  $(npx next --version 2>/dev/null || echo '?')"
    @echo "just  $(just --version 2>/dev/null || echo '?')"
    @echo "gcloud $(gcloud --version 2>/dev/null | head -1 || echo '?')"

# List all recipes
list:
    @just --list --justfile {{ justfile() }}

# EOF