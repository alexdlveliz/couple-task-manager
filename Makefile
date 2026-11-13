.PHONY: serve migrate

ifneq ($(origin ENV), undefined)
export ENV
endif

serve:
	@node scripts/serve.mjs

migrate:
ifeq ($(origin ENV), undefined)
	@node scripts/migrate.mjs
else
	@node scripts/migrate.mjs --environment-from-env
endif
