.PHONY: serve test migrate

ifneq ($(origin ENV), undefined)
export ENV
endif

serve:
	@node scripts/serve.mjs

test:
	@node scripts/test-workflow.mjs

migrate:
ifeq ($(origin ENV), undefined)
	@node scripts/migrate.mjs
else
	@node scripts/migrate.mjs --environment-from-env
endif
