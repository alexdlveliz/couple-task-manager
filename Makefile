.PHONY: serve test migrate deploy lint

ifneq ($(origin ENV), undefined)
export ENV
endif

serve:
	@node scripts/serve.mjs

lint:
	@node scripts/quality.mjs

test:
	@node scripts/test-workflow.mjs

deploy:
	@node scripts/deploy.mjs

migrate:
ifeq ($(origin ENV), undefined)
	@node scripts/migrate.mjs
else
	@node scripts/migrate.mjs --environment-from-env
endif
