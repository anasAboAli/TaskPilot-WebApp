# TaskPilot-WebApp — shortcuts for common Docker tasks
# Usage: make <target>     (run `make help` to list targets)

IMAGE     := taskpilot-webapp
TAG       := latest
CONTAINER := taskpilot
PORT      ?= 3000
VOLUME    := taskpilot-data

.PHONY: help build run stop logs health test clean up down

help: ## Show available commands
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-8s\033[0m %s\n", $$1, $$2}'

build: ## Build the Docker image (runs tests during the build)
	docker build -t $(IMAGE):$(TAG) .

run: ## Run the container in the background on http://localhost:$(PORT)
	docker run -d --name $(CONTAINER) -p $(PORT):3000 -v $(VOLUME):/app/data $(IMAGE):$(TAG)
	@echo "TaskPilot is running at http://localhost:$(PORT)"

stop: ## Stop and remove the container
	-docker stop $(CONTAINER)
	-docker rm $(CONTAINER)

logs: ## Follow container logs
	docker logs -f $(CONTAINER)

health: ## Show the container health status
	@docker inspect --format='{{.State.Health.Status}}' $(CONTAINER)

test: ## Run the test suite inside Docker (test stage only)
	docker build --target test -t $(IMAGE):test .

up: ## Start with Docker Compose
	docker compose up -d --build

down: ## Stop Docker Compose services
	docker compose down

clean: stop ## Remove container, image and data volume
	-docker rmi $(IMAGE):$(TAG) $(IMAGE):test
	-docker volume rm $(VOLUME)
