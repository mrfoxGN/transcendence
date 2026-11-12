# DevUP frontend design baseline

Source: [DevUP Figma canvas](https://www.figma.com/design/O3KfWRH9NlVSbzckS45xfL/DevUP-%E2%80%94-Landing-Page?node-id=5-2). Read-only extraction of applied values from the landing page and six app frames. Treat the current design as a baseline to refine after reviewing the next set of references.

## Observed foundations

| Role | Public landing | Signed-in app |
|---|---|---|
| Background and surfaces | White #FFFFFF, warm off-white #FBFCF9 | White #FFFFFF, near-white #FFFFFE, pale gray #F9F9F9 |
| Main text | #0B2522 | #112445, #111528, #0F172A |
| Secondary text | #576B66 | #63709F and #878B94 appear repeatedly |
| Brand and action colors | To be defined | Blue #3472D8, purple #A855F7 |
| Borders | #E5ECE4 | #D4D5D9 and #ECECEE |
| Soft accents | #EBEDE0 | Pale blue #DBEBFC and lavender #F0E4FB appear on the board |
| Typography | Mostly Inter Regular, Medium and Semi Bold, with occasional Poppins | Mostly Inter Medium, Semi Bold and Bold, with some Poppins in dense screens |
| Corners | 16–22 px on many cards | 8 and 12 px recur; badges and avatars often use pill or circular corners |

Landing frame width is 1440 px. Board, Backlog, Chat, Activity, Files, and Team frames are 1672 × 1024 px. These are reference canvases. The designs include mixed spacing and fractional sizes. The frames do not establish responsive breakpoints.

The file contains one local variable collection, Colors, with 55 entries and one mode. Queries for bound variables on the landing, Board, Chat and Files frames returned a small set that includes Material 3 On Surface and some imported-library values. The palette above comes from applied frame and text fills. Subscribed kits include Material 3 and Simple Design System. The inspected frames contain component instances and no local component definitions within those frames.

## Proposed defaults to validate against inspirations

- Keep neutral surfaces with blue actions in the app. Use purple selectively for identity or tags. Decide the landing accent after reviewing the inspirations.
- Use Inter as the shared family. Start with 14–16 px for ordinary app text, 12 px for compact metadata, and larger section and page titles. Keep the smaller sampled type sizes as observations rather than defaults.
- Use a spacing scale of 4, 8, 12, 16, 24 and 32 px. Use 8 px for controls and 12 px for app cards as initial radius defaults.
- Reuse app header, workspace switcher, sidebar, buttons, form fields, tabs, badges, avatars, tables, cards, panels and dialogs. Board cards, file rows, member rows and chat bubbles can compose these primitives.
- Define hover, focus, disabled, loading, empty and error treatments as the pages are refined. Decide mobile navigation and narrow-screen behavior after reviewing the references.
- Preserve the page map and backend constraints from the project review. Visual references can change the presentation while the verified API defines supported actions.

## Free references

- [Figma Community UI kits](https://help.figma.com/hc/en-us/articles/24037724065943-Start-designing-with-UI-kits) for design exploration. Material 3 is already attached and can serve as a reference for component states.
- [shadcn/ui Figma resources](https://ui.shadcn.com/docs/figma) for matching design and implementation patterns if the frontend uses React.
- [Untitled UI free Figma kit](https://www.untitledui.com/free-figma-ui-kit) for individual exploration of dashboards and forms. The free license is single-user, so check the terms before adopting it as a team library.

## Defined design-system colors (2026-11-07)

These user-defined colors supersede the provisional palette above. The canonical implementation is `apps/frontend/src/tokens.css`, imported globally. Numbered variants preserve the supplied order; `-light` tokens are surfaces, not text colors.

| Color | Main values | Light tints |
|---|---|---|
| Ink / navy | #0F172A | #ECECEE |
| Canvas / off-white | #FAF9F6 | #FFFFFE |
| Soft Violet / purple | #A855F7 | #F8F1FE |
| Signal Blue | #3B82F6 | #EFF5FE |
| Lime | #A3F460 | #F8FEF2 |
| Pink | #FC3095, #FF4BA6, #FF6796 | #FFB9DE, #FDEAF5, #FFEAF1 |
| Green / mint | #10BE6C, #1FD295, #05D47A | #E8FCF3, #E2FAF1 |
| Orange / amber | #FAA51C, #FEA221, #FD9133 | #FCEBDB, #FEF3E4 |
| Yellow / gold | #FDC64E, #FEBA2F | #FFF2CA |
| Red / coral | #FC3843, #FF123A, #FF6B6B | #FCDBDB, #FEECEF |
| Bright violet / indigo | #762AE7, #6D2AFE, #5540F9 | #F0E4FB, #F1EEFE |
| Gray | #525866, #878B94, #B2B5BB | #D4D5D9, #E2E8F0 |
| White / black | #FFFFFF, #000000 | â€” |

### Landing-page application

Inter remains the shared typeface, with navy headings, gray body text, off-white/white surfaces, and indigo primary buttons (white text has stronger contrast here than on Signal Blue). Blue and Soft Violet identify features; lime marks completion. Use 8 px controls and 12 px cards, a 4/8/12/16/24/32 px spacing scale, and generous section spacing. The Privy reference informs layout: split hero, pastel atmospheric backgrounds, a feature grid, split product walkthrough, control cards, and column footer. Content and branding remain DevUP. No third-party endorsements or certification claims are implied.

## Workspace gradient usage

Keep the workspace shell, tables, task cards, chat bubbles, and code panes on neutral surfaces. Use gradients at specific points of attention so people can still scan dense screens.

- **Gradient icon tile.** Apply a `--workspace-accent-*-icon` gradient to the background of a small rounded tile. Use `--workspace-accent-icon-ink` for the icon inside it. Good placements include folder icons, activity types, attachment icons, and the icons in Home or Analytics stat cards.
- **Accent card or panel.** Apply the matching `--workspace-accent-*-surface` gradient to a featured stat card, folder shortcut, or selected-file inspector banner. Pair it with the theme’s normal text color. Keep most cards neutral and reserve the stronger gradient for the icon.
- **Dark mode.** Set `data-theme="dark"` on the workspace root to pick up the darker surface gradients. Keep the same color for the same item across themes, and check icon and text contrast on the actual gradient.

| Accent | Suggested use |
|---|---|
| Blue | Comments, collaboration, and repository icons |
| Violet | Overall activity, work in progress, and frontend folders |
| Pink | Review, design folders, and file upload metrics |
| Mint | Completed work, successful sync summaries, and backend folders |
| Orange | Task update metrics and documentation folders |

Use the same accent when an item appears in more than one place. For example, a pink Design folder can have a pink icon tile in the file grid and a soft pink banner in its inspector. Keep text labels and status indicators visible so users can recognize states without relying on color alone. Use dedicated status colors for errors, warnings, and code diffs.

## Check GodUI before building

Before implementing a new component, interaction, or animation, check whether DevUP already has a suitable pattern. If there is a gap, search GodUI first for the specific item. Reuse or adapt a suitable match to DevUP’s tokens and layout, and verify keyboard access, responsiveness, dark mode, and reduced motion where applicable. Build a custom version when the available patterns do not meet the need.
