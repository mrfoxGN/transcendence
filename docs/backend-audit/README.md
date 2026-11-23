# Backend audit and frontend migration reference

Audited 2026-11-23 from `mrfoxGN/transcendence`, branch `main`, commit
`d40145400edeaef018e6bad24c2e9851ebbe35a3`.
Backend source tree: `13bd89ecb88de422feabd64a9f474ece71d65435`.

This is a source audit, not a runtime certification. No services were started,
no migrations were run, no accounts/data were copied, and no `.env` values were
read or transferred. Backend, frontend and deployment implementation files remain
unchanged. The documentation branch is `codex/backend-api-inventory`.

## Read in this order

1. [Features and integration rules](FEATURES.md): capabilities, permissions,
   workflow, query restrictions and concrete request examples.
2. [HTTP API catalog](HTTP_API.md): **112 controller operations**, native routes,
   authentication, declared/default status, signatures and source links.
3. [DTO reference](DTO_REFERENCE.md): exact snapshots of **56 DTO files**, plus
   inline controller validation classes. Includes request and response shapes.
4. [Real-time API](REALTIME.md): Socket.IO authentication, subscriptions and events.
5. [Migration comparison](MIGRATION.md): what differs from the previously used
   repository, what to preserve, branch divergence, and the migration sequence.
6. [Schema and configuration](SCHEMA_AND_CONFIG.md): enums, migrations, entities,
   and environment variable names without secret values.

## Scope and evidence

Routes were traced through controllers; validation through DTOs; key permission,
workflow, persistence and serialization behavior through services, guards and
mappers. The catalog is generated from checked-in source, including methods with
inferred return types. Those methods link to the source; they do not pretend to
provide a generated OpenAPI response schema.

The old [frontend handoff](../FRONTEND_HANDOFF.md) is historical. Its claims that
there is no frontend and that GitHub, account recovery, invitation listing and
session revocation are missing no longer describe this snapshot. Its historical
runtime results and dependency audit numbers were not rerun or adopted here.

## Regenerate and validate

From this repository root:

```sh
python3 docs/backend-audit/generate_inventory.py
```

This updates HTTP, DTO, schema/config references and `inventory.json` without
starting Nest or touching a database. Regenerate after backend changes and review
the human-written feature/migration/realtime guides as well. The source-tree hash
makes backend drift detectable even after documentation commits.

Recommended next step: migrate on a new branch based on this audited `main`,
leaving `apps/backend`, migrations, deployment and environment configuration intact.
Do not use an older remote branch merely because its name contains `frontend`.
