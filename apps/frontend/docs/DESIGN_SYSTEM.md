# DevUP design system

A custom, project-owned component system built with React, TypeScript, plain CSS and Lucide icons. There is no component showcase page. The production pages are its consumers.

## Foundations

The approved workspace palette is defined in `src/shared/design-system/tokens.css`. Use semantic custom properties rather than copying hex values into page styles.

| Purpose            | Token               | Light     | Dark      |
| ------------------ | ------------------- | --------- | --------- |
| Canvas             | `--wu-canvas`       | `#f2f3f7` | `#111216` |
| Surface            | `--wu-surface`      | `#ffffff` | `#1d1f25` |
| Soft surface       | `--wu-surface-soft` | `#eff1f6` | `#282b33` |
| Raised surface     | `--wu-raised`       | `#ffffff` | `#30343d` |
| Main text          | `--wu-ink`          | `#151821` | `#f3f4f8` |
| Secondary text     | `--wu-muted`        | `#525b6c` | `#bbc1ce` |
| Border             | `--wu-line`         | `#dce0e8` | `#3a3f49` |
| Interaction accent | `--wu-violet`       | `#6442c2` | `#c3b2ff` |
| Focus              | `--wu-focus`        | `#7954d4` | `#bea5fa` |
| Pink accent        | `--wu-pink`         | `#a53c7b` | `#e5add3` |

`--wu-blue` is an older alias for the current interaction accent, retained to preserve existing selectors. Decorative blue, pink and violet glows use `--wu-glow-*`. Brand gradients belong in the sidebar, selected content highlights and restrained primary buttons. Use green, amber and red for meaningful status and chart series; project/note decorative gradients remain blue, pink and violet.

Dark mode uses charcoal layers, softer borders and readable accent colors. It is not a CSS inversion. Entry pages retain their deliberately separate `--entry-*` surface tokens and share the same typography, form spacing and focus principles. The older root `tokens.css` still supplies illustration and public-page colors; it is not the source for workspace surfaces.

### Type and space

Inter Variable is the UI family. The token scale is 11px captions, 12px labels, 13px body, 14px reading text, 16px section headings and 24px page titles. Regular/medium/semibold weights are 400/550/600. Existing feature-specific data visualizations and entry titles may use larger sizes.

Use `--space-1/2/3/4/5/6/8` for 4/8/12/16/20/24/32px spacing. Controls use `--radius-control` (8px); panels use `--radius-panel` (16px). Form labels, groups and adjacent actions use the shared field-gap tokens.

### Icons

Use Lucide through `Icon` in new shared UI. Sizes are `small` (14), `medium` (16), `large` (20) and `feature` (24), with a default 1.75 stroke. A numeric size is allowed when matching existing content. Decorative icons are hidden from assistive technology; supply `label` for a meaningful standalone icon. An icon-only button needs its own `aria-label`.

### Interaction rules

- Rows change background gently; selection stays distinct from hover.
- Cards gain a quiet border/shadow emphasis. Avoid layout shifts and animated row movement.
- Inputs have one focus owner. An input inside a search wrapper must not acquire a second focus outline.
- Menus use neutral surfaces with accent selection, a short entrance and predictable Escape behavior.
- Hover opening waits 200ms; leaving waits 220ms so the pointer can cross a gap. Click pins a hover-opened menu. Hover never changes settings or marks notifications read.
- Preserve keyboard and touch behavior. Respect `prefers-reduced-motion`.

## Reusable components

Import from `src/shared/ui` (relative to the calling file). The library contains 21 exported reusable components:

| Component               | Responsibility                                                | Existing production use                    |
| ----------------------- | ------------------------------------------------------------- | ------------------------------------------ |
| `Button`                | Primary, secondary or destructive action; native button props | Workspace forms and page actions           |
| `IconButton`            | Named icon-only action                                        | File, task and dialog actions              |
| `Input`                 | Native text, search, date, number and other input contracts   | Task, settings and project forms           |
| `Textarea`              | Native multiline input                                        | Task and workspace descriptions            |
| `Select`                | Custom single selection with a native form control            | Filters and forms across workspace pages   |
| `Checkbox`              | Native multiple-choice or boolean control                     | Task and notification preferences          |
| `Switch`                | Immediate on/off setting with switch semantics                | Notification badge setting                 |
| `FormField`             | Label, stable control ID, help and validation feedback        | Note and project editors                   |
| `Card`                  | Semantic section with the approved panel surface              | Home, analytics, settings and other panels |
| `Badge`                 | Read-only category or status label                            | Task status and team roles                 |
| `Avatar`                | Initials and optional preview portrait                        | Team and task identity                     |
| `AvatarGroup`           | Compact accessible contributor group                          | Project progress                           |
| `Icon`                  | Lucide size, stroke and accessible-name convention            | Shared dialog and action-menu controls     |
| `IconTile`              | Decorative category icon container                            | Page and metric accents                    |
| `FilterChips`           | A labeled group of mutually exclusive filters                 | Home, board, activity and analytics        |
| `Tabs`                  | Manual-activation tabs with arrow/Home/End navigation         | GitHub workspace navigation                |
| `Dialog`                | Native modal/drawer with title, dismissal and focus handling  | Task details, editors and confirmations    |
| `ActionMenu`            | Positioned actions with keyboard movement and dismissal       | Files and team management                  |
| `EmptyState`            | Existing workspace empty-state layout                         | Backlog                                    |
| `IllustratedEmptyState` | Theme-aware artwork, explanation and optional action          | Empty/search/error views across pages      |
| `LoadingPanel`          | Named loading status with decorative skeletons                | Workspace collections                      |

These components remain small. Business logic and API calls belong to their features. Existing domain components such as `TaskTable`, `MetricCard` and `DocumentPagination` remain feature-owned because they know task fields or backend pagination rules.

## Examples

### A labeled field

```tsx
import { Button, FormField, Input } from '../../../shared/ui';

<form onSubmit={saveProject}>
  <FormField
    label="Project name"
    htmlFor="project-name"
    hint="Use a name your team will recognize."
    error={nameError}
  >
    <Input name="name" required maxLength={120} />
  </FormField>
  <Button variant="primary" type="submit" disabled={saving}>
    {saving ? 'Saving…' : 'Save project'}
  </Button>
</form>;
```

Use a direct control child with `FormField`; it connects the control's ID and `aria-describedby` to the rendered label/help/error. Keep an adjacent action outside that simple wrapper or use the existing `wu-input-row` pattern. Error visibility is controlled by the feature; do not announce validation before the user has tried the action.

### An icon action

```tsx
import { Pin } from 'lucide-react';
import { Icon, IconButton } from '../../../shared/ui';

<IconButton
  aria-label={pinned ? 'Unpin project' : 'Pin project'}
  aria-pressed={pinned}
  onClick={togglePin}
>
  <Icon icon={Pin} fill={pinned ? 'currentColor' : 'none'} />
</IconButton>;
```

### Filters versus tabs

Use `FilterChips` when narrowing the current collection. Use `Tabs` when switching between distinct panels. For each tab, render a panel with `id="{idPrefix}-panel-{value}"`, `role="tabpanel"` and `aria-labelledby="{idPrefix}-tab-{value}"`. Arrow keys move focus; Enter/Space activates. IDs must be unique if multiple tab groups appear on one page. If a feature reuses one panel for all tabs, pass its stable `panelId` to `Tabs` and update that panel's `aria-labelledby` to the selected tab, as the GitHub page does.

### Confirmation

`Dialog` uses the existing drawer presentation by default. Pass `confirmation` for a destructive confirmation and provide a clear title, consequence and explicit action. `closeDisabled` prevents dismissal while a non-interruptible action is saving. Never delete merely because an action menu opened.

## Styling ownership

The palette and shared dimensions live in `design-system/tokens.css`; shared interaction rules live in `shared/styles`. Component-specific switch/select/menu rules stay with their controls. Page layout belongs to the owning feature. The final global cascade is declared in `src/app.css`, imported after feature modules by `main.tsx`. `npm run check:styles` protects this entry point; do not alphabetize CSS layers. Do not add another global palette override or use `!important` to conceal an ownership conflict.

The component APIs pass native props through. CSS classes are retained from the approved implementation so existing light/dark, responsive and focus rules continue to apply. A future visual change should update the component or token that owns it and be verified on its consumers.
