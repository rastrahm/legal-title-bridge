# Legal Title Bridge — make check stages (BOOT+)
# Prefer Foundry from ~/.foundry/bin (nvm may ship a conflicting `forge`).

export PATH := $(HOME)/.foundry/bin:$(HOME)/.cargo/bin:$(PATH)

.PHONY: help check check-boot fmt lint lint-smoke test-forge test-forge-heavy build-forge \
	build-anchor test-ts build-frontend tools-versions hooks

help:
	@echo "Targets: check | check-boot | fmt | lint | lint-smoke | test-forge | test-forge-heavy | build-forge | build-anchor | test-ts | build-frontend | hooks | tools-versions"

# Full gate grows with phases; BOOT subset:
check: check-boot

check-boot: fmt lint lint-smoke build-forge test-forge build-anchor test-ts build-frontend
	@echo "make check-boot: OK"

fmt:
	forge fmt --check

lint:
	./scripts/lint.sh

lint-smoke:
	./scripts/lint-smoke-fixture.sh

build-forge:
	forge build

test-forge:
	forge test

# Invariantes depth=100 / fuzz 2000 — para la i9 cuando quieras quemar CPU
test-forge-heavy:
	forge test --profile heavy

build-anchor:
	cd solana && anchor build

test-ts:
	@. $(HOME)/.nvm/nvm.sh && nvm use 22 >/dev/null && npm run test:ts
	@. $(HOME)/.nvm/nvm.sh && nvm use 22 >/dev/null && cd frontend && npm test

build-frontend:
	@. $(HOME)/.nvm/nvm.sh && nvm use 22 >/dev/null && cd frontend && npm run lint && npx tsc --noEmit && npm run build

hooks:
	./scripts/install-hooks.sh

tools-versions:
	@echo "=== Toolchain versions ==="
	@forge --version | head -1
	@solc --version 2>/dev/null || echo "solc: managed by foundry (0.8.37)"
	@anchor --version
	@solana --version
	@cargo --version
	@. $(HOME)/.nvm/nvm.sh && nvm use 22 >/dev/null && node -v && npm -v
	@command -v slither >/dev/null && slither --version || echo "slither: NOT INSTALLED"
	@command -v aderyn >/dev/null && aderyn --version || echo "aderyn: NOT INSTALLED"
	@command -v cargo-audit >/dev/null && cargo audit --version || echo "cargo-audit: NOT INSTALLED"
