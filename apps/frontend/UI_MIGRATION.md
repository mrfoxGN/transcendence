# Frontend migration into mrfoxGN/transcendence

Target branch: `frontend`, based on main `d401454` plus audit `7272a03`.
Approved design source: `ELMO-KH/ft_transcendence` frontend commit `952d0f7`.

## Scope

The approved workspace and entry-page design, light/dark themes, charts, folder and
note cards, rich-text editor, file controls, and theme-aware illustrations were
transferred under `apps/frontend`. The target's custom avatar upload/compression
was retained and combined with the approved onboarding preview.

The target Dockerfile, Nginx config, TLS entrypoint, Vite proxy, backend, migrations,
Compose file and environment example were retained. No `.env` or user/database
content was copied from the previous repository. Verification scripts default to
port 5182 and accept `DEVUP_APP_URL` for another frontend instance.

## Initial verification

- Production frontend build passed (existing chunk-size warning remains).
- Workspace fixture checks passed: 36 desktop/mobile/theme page views plus Notes,
  task workflow, file upload/filter/grid/recent, and GitHub interaction checks.
- Entry fixture checks passed: 32 light/dark desktop/mobile views, short screens,
  workspace selector, 2FA transition, avatar choice and recovery transition.

The fixture checks are not a substitute for target-backend verification. The
isolated `devup-mrfoxgn-migration` Compose stack uses ports 3337/8087/8447 and its
own volumes. Runtime API checks and the final unsupported-feature report follow
in subsequent migration commits.
