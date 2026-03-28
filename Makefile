.PHONY: start down semgrep sonar-up sonar-down sonar-scan

start:
	docker compose up -d

down:
	docker compose down

semgrep:
	docker run --rm -v "$(shell pwd):/src" semgrep/semgrep semgrep scan --config auto

sonar-up:
	docker compose -f docker-compose.sonarqube.yml up -d

sonar-down:
	docker compose -f docker-compose.sonarqube.yml down

sonar-scan:
	@if [ -f .sonar.env ]; then \
		export $$(cat .sonar.env | xargs) && \
		./node_modules/.bin/sonar-scanner -Dsonar.token=$$SONAR_TOKEN -Dsonar.host.url=http://localhost:9000; \
	else \
		echo "Arquivo .sonar.env não encontrado. Crie-o com SONAR_TOKEN=seu_token"; \
		exit 1; \
	fi
