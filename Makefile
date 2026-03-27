.PHONY: start down semgrep

start:
	docker compose up -d

down:
	docker compose down

semgrep:
	docker run --rm -v "$(shell pwd):/src" semgrep/semgrep semgrep scan --config auto
