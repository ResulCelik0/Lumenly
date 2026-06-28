# Lumenly — developer & ops shortcuts
# Run `make` or `make help` to see all targets.

IMAGE       := lumenly:latest
CONTAINER   := lumenly
COMPOSE     := docker compose
PROD_PORT   := 8080
DEV_PORT    := 5173

.DEFAULT_GOAL := help

## ---------------------------------------------------------------------------
## Help
## ---------------------------------------------------------------------------
.PHONY: help
help: ## Show this help
	@echo "Lumenly — make targets:"
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

## ---------------------------------------------------------------------------
## Local (no Docker)
## ---------------------------------------------------------------------------
.PHONY: install
install: ## Install npm dependencies locally
	npm install

.PHONY: dev-local
dev-local: ## Run the Vite dev server on the host (no Docker)
	npm run dev

.PHONY: build-local
build-local: ## Type-check and build locally into dist/
	npm run build

.PHONY: lint
lint: ## Type-check the project (tsc --noEmit)
	npm run lint

## ---------------------------------------------------------------------------
## Docker — production
## ---------------------------------------------------------------------------
.PHONY: build
build: ## Build the production Docker image
	$(COMPOSE) build web

.PHONY: up
up: ## Build & start the production container (http://localhost:$(PROD_PORT))
	$(COMPOSE) up -d --build web
	@echo "➜  Lumenly running at http://localhost:$(PROD_PORT)"

.PHONY: down
down: ## Stop and remove all containers
	$(COMPOSE) down

.PHONY: restart
restart: down up ## Restart the production container

.PHONY: logs
logs: ## Tail container logs
	$(COMPOSE) logs -f

.PHONY: sh
sh: ## Open a shell inside the running production container
	docker exec -it $(CONTAINER) sh

## ---------------------------------------------------------------------------
## Docker — development (hot reload)
## ---------------------------------------------------------------------------
.PHONY: dev
dev: ## Start the Vite dev server in Docker (http://localhost:$(DEV_PORT))
	$(COMPOSE) --profile dev up dev

.PHONY: dev-down
dev-down: ## Stop the dev container
	$(COMPOSE) --profile dev down

## ---------------------------------------------------------------------------
## Security
## ---------------------------------------------------------------------------
.PHONY: audit
audit: ## Run npm dependency vulnerability audit
	npm audit

.PHONY: scan
scan: ## Scan the built image for CVEs with Trivy (if installed)
	@command -v trivy >/dev/null 2>&1 \
		&& trivy image --severity HIGH,CRITICAL $(IMAGE) \
		|| echo "trivy not installed — see https://trivy.dev (brew install trivy)"

.PHONY: headers
headers: ## Check the live security headers (container must be up)
	@echo "Fetching headers from http://localhost:$(PROD_PORT) ..."
	@curl -sI http://localhost:$(PROD_PORT) | grep -iE \
		'content-security-policy|x-frame-options|x-content-type|referrer-policy|permissions-policy|strict-transport|cross-origin' \
		|| echo "No security headers found — is the container running? (make up)"

## ---------------------------------------------------------------------------
## Cleanup
## ---------------------------------------------------------------------------
.PHONY: clean
clean: ## Remove containers, image and local build output
	-$(COMPOSE) down --remove-orphans
	-docker rmi $(IMAGE) 2>/dev/null || true
	rm -rf dist
