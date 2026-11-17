# Legal Title Bridge — make check stages (BOOT+)
# Prefer Foundry from ~/.foundry/bin (nvm may ship a conflicting `forge`).

export PATH := $(HOME)/.foundry/bin:$(HOME)/.cargo/bin:$(PATH)

.PHONY: help check check-boot check-codec check-title fmt lint lint-smoke test-forge test-forge-heavy build-forge \
	build-anchor test-ts build-frontend tools-versions hooks gen-vectors

help:
	@echo "Targets: check | check-boot | check-codec | check-title | gen-vectors | fmt | lint | test-forge | test-forge-heavy | build-forge | build-anchor | test-ts | build-frontend | hooks | tools-versions"

# Full gate grows with phases; default = boot + codec + title
check: check-boot check-codec check-title

check-boot: fmt lint lint-smoke build-forge test-forge build-anchor test-ts build-frontend
	@echo "make check-boot: OK"

gen-vectors:
	forge test --match-test test_WriteGoldenVectors -vv

# C5: identical wire/messageId/signingDigest in Solidity, Rust, TypeScript
check-codec: gen-vectors
	forge test --match-contract PacketCodecTest
	cd solana && cargo test -p title_mirror codec -- --nocapture
	@. $(HOME)/.nvm/nvm.sh && nvm use 22 >/dev/null && cd shared && npm run test:codec
	@echo "make check-codec: OK (C5)"

# TITLE: IdentityRegistry + TitleRegistry + compliance + I1/I7/I9
check-title:
	forge test --match-contract "IdentityRegistryTest|TitleRegistryTest|LedgerChainTest|TitleRegistryInvariants"
	@echo "make check-title: OK"

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
