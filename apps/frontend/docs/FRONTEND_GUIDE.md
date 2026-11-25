# DevUP frontend guide

DevUP is a React + TypeScript workspace for tasks, projects, notes, files, chat and team collaboration. This guide describes the frontend in this repository. It does not change the backend contract.

## Where to look

```text
src/
  main.tsx                      Selects the entry page or workspace shell
  features/
    WorkspaceApp.tsx            Workspace routing, shared data and page composition
    WorkspacePicker.tsx         Workspace entry flow and its actions
    auth/session.ts             Access-token storage, sign-out and account switching
    auth-routing.ts             Return destinations and account HTTP requests
    auth/                       Sign-in and entry-flow components
    workspace/
      ProfileMenu.tsx           Account menu and theme disclosure
      WorkspaceSwitcher.tsx     Workspace selection
      NotificationInbox.tsx     Notification data and actions
      workspace-*-api / helpers  Typed requests and domain transformations
      pages/                    Page-specific UI and styles
  shared/
    ui/                         Reusable visual and interactive components
    controls/                   Select behavior and hover-intent hooks
    design-system/              Approved tokens and theme types
    illustrations/              Light/dark empty-state artwork
    charts/                     Shared chart presentation
    styles/                     Cross-page layout, state and appearance rules
```

`workspace-api.ts` handles authenticated workspace requests; the other `workspace-*` modules keep task, project, file, chat and document behavior close to their domain. `workspace-picker-api.ts` owns the workspace-entry request contract. API helpers import session logic from `auth/session.ts`, never from a rendered page.

## Three responsibilities

1. A **shared UI component** receives props and renders a control. It does not fetch workspace data, know the current user or construct API URLs.
2. A **feature component or hook** knows the business object and its interactions: a project pin, file upload or notification action.
3. A **page or shell** composes features, coordinates data and decides which view is visible.

Keep components together when their code is easier to understand together. Extract a component when it has a clear name and responsibility; avoid creating a file for every small block of markup.

## Adding a feature

1. Check the existing API documentation and domain helpers. Reuse supported endpoints and payloads.
2. Put reusable presentation in `shared/ui`; put workspace-specific behavior in `features/workspace`.
3. Import existing controls from `shared/ui`. Native props such as `name`, `required`, `disabled`, `ref` and `onChange` pass through.
4. Use the approved tokens for colors and shared dimensions. Keep layout rules in the owning feature stylesheet.
5. Provide loading, empty, error, read-only and long-text behavior where applicable.
6. Check keyboard operation, narrow screens and both themes. Preserve focus after dialogs and menus close.
7. Format, type-check and run the relevant fixture checks before committing.

## Forms and requests

- Give each control a visible label and a stable ID. Use `FormField` for a simple labeled control with optional help or validation feedback.
- Use `type="submit"` deliberately. Shared `Button` and `IconButton` default to `type="button"` to avoid accidental submission.
- Keep input state in the feature that saves it. Shared controls must not make API calls.
- Preserve existing DTO field names, allowed values and HTTP methods. A design refactor is not an API migration.
- Handle a failed request with an explanation and a retry or correction action.
- Keep tokens in session storage through the existing session helpers; never put credentials in source or documentation.

## Names, comments and formatting

Use domain names such as `selectedWorkspace`, `onClose` and `loadWorkspaces`. Prefer readable statements over compressed one-line handlers. Comment a reason or a non-obvious browser contract, not what the next line plainly does. Use TypeScript props instead of `any`.

Prettier supplies consistent formatting. TypeScript checks prop and data contracts and rejects unused imports, locals and parameters. Do not add a dependency for a simple operation already handled by React, browser APIs or the existing helpers.

```sh
npm ci
npm run format
npm run check
npm run build
```

`format` covers TypeScript/TSX source, browser-check scripts, design-system CSS and these guides. Existing feature CSS remains scoped and is not mechanically reformatted as part of that command.

## Browser verification

The scripts use Playwright and isolated HTTP fixtures; their mutations do not seed or modify a real workspace. Start the local frontend first. The default fixture URL is `http://localhost:5182`; override it with `DEVUP_APP_URL` if needed. Set `CHROMIUM_PATH` to an installed Chromium executable when Playwright's default browser is unavailable.

```sh
npm run verify:migration
MOTION_ONLY=1 npm run verify:migration
DROPDOWNS_ONLY=1 npm run verify:migration
SETTINGS_ONLY=1 npm run verify:migration
node scripts/verify-entry-pages.mjs
```

The full migration check covers representative pages in both themes and desktop/mobile layouts, plus note editing, task transitions, file uploads and GitHub actions. Focused modes cover interaction details. Screenshots go to `/tmp/devup-migration-artifacts`.

## Compatibility and further edits

Existing imports from `workspace/components.tsx` and `WorkspaceControls.tsx` continue to work. They re-export shared components under older names: `Panel` is `Card`, `Pill` is `Badge`, and `Drawer` is `Dialog`. New code should use the names in `shared/ui`.

The existing `wu-*` classes are intentional compatibility hooks for the approved design. They are not renamed during this cleanup. Feature styles still contain historical presentation rules; change them in small, visually checked steps rather than merging unrelated selectors or changing CSS load order.

Large account and workspace pages still own their workflow state. Continue separating them when a specific feature changes; do not split a working form simply to reach a line-count target.
