---
name: Couple Task Manager
description: A warm, focused shared workspace for two people.
colors:
  canvas: "#f5f0e8"
  surface: "#fffdfa"
  ink: "#302c29"
  primary: "#315b47"
  primary-hover: "#234535"
  filter-surface: "#f1e8db"
  chip-border: "#968578"
  chip-hover: "#d9e6da"
  chip-hover-ink: "#203b2d"
  summary: "#f5d9bd"
  initials-ink: "#40312a"
  muted: "#62554c"
  border: "#9e8a7b"
  focus: "#985b28"
  status-default: "#f2e9de"
  status-progress: "#e5ede5"
  status-blocked: "#f7e5d9"
  status-completed: "#e8e8df"
  white: "#fff"
  accent: "#735044"
  active: "#39241e"
  secondary-ink: "#593b30"
  secondary-hover: "#eee2d6"
  selection: "#e5cbb5"
  divider-strong: "#d7c8ba"
  divider: "#e0d5ca"
  row-divider: "#e8ded5"
  sync-text: "#554b43"
  filter-text: "#4f4139"
  metadata: "#65574d"
  status-text: "#49392f"
  status-border: "#c9b8a9"
  backdrop: "#30251fc0"
typography:
  heading:
    fontFamily: "Georgia, serif"
    fontSize: "1.65rem"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  page-title:
    fontFamily: "Georgia, serif"
    fontSize: "clamp(2rem, 5vw, 3.25rem)"
  metadata:
    fontFamily: '"Trebuchet MS", "Segoe UI", sans-serif'
    fontSize: "0.9rem"
  label:
    fontFamily: '"Trebuchet MS", "Segoe UI", sans-serif'
    fontSize: "0.875rem"
  body:
    fontFamily: '"Trebuchet MS", "Segoe UI", sans-serif'
    fontSize: "1rem"
    lineHeight: 1.5
rounded:
  control: ".5rem"
  button: ".65rem"
  list: ".85rem"
  dialog: "1rem"
  chip: "2rem"
spacing:
  small: ".5rem"
  medium: "1rem"
  large: "1.5rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.white}"
    rounded: "{rounded.button}"
    padding: ".55rem 1rem"
    height: "44px"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: ".5rem"
    height: "44px"
  task-list:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.list}"
  filter-chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.chip}"
    padding: ".55rem 1rem"
    height: "44px"
  filter-chip-selected:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.white}"
    rounded: "{rounded.chip}"
---

# Design System: Couple Task Manager

## Overview

**Creative North Star: "Warm Daily Journal"**

A calm shared workspace with the warmth of a daily journal and the clarity of a task app. Paper-like surfaces and a quiet serif heading give the app a human character; familiar controls and compact list rows keep attention on the work.

**Key Characteristics:**

- Warm neutrals and restrained status colors.
- Serif headings paired with readable sans-serif controls and task text.
- A date-led header and a shared list grouped by deadline, with clear filters and direct status selection.
- Mobile-first spacing, visible focus, and honest synchronization feedback.

## Colors

Warm paper and ink form the base. Deep green identifies primary actions and selected filters; pale status colors support, but never replace, text labels. The focus color marks keyboard interaction. Dividers and field outlines provide quiet structure.

## Typography

Georgia gives headings a personal voice; Trebuchet MS with Segoe UI and sans-serif fallbacks carries the interface. Body text is 16px with 1.5 line height. Task metadata and filters use a compact 0.9rem and 0.875rem scale respectively. User-facing content remains in Spanish.

## Layout

The centered main area is capped at 60rem with 1.25rem padding, reduced to 1rem on screens at or below 560px. A date, large title, and partner initials lead the page; a peach summary accompanies the board heading. Deadline groups contain full-width task rows separated by fine rules. On small screens, task actions move below task details and the create action fills the available width. Filter chips wrap as space requires.

## Elevation & Depth

Use tonal layers rather than shadows: the page, filter area, and list surface are distinct. A translucent dark backdrop separates an open dialog from the page.

## Shapes

Controls and surfaces use softly rounded corners. Deadline groups sit in softly bordered lists, with rows separated by fine lines rather than individual card outlines. Filter buttons use pill shapes; partner initials sit in circles. Fields and buttons have visible borders and a minimum 44px height.

## Components

### Buttons and fields

Primary buttons use the green action color with white text; secondary buttons use the light surface and brown text. Text actions are underlined. Inputs and selects use light surfaces and visible borders. Keyboard focus has a 3px ochre outline with a 3px offset. Disabled buttons and selects have reduced opacity.

### Shared task list

Each row shows the task title, assignee, deadline, a labeled status selector, and an edit action. Pill filters apply to status and assignee, exposing their selected state with pressed semantics; show a result count and a useful empty state. Tasks are grouped under deadline headings. Status controls use text as well as subtle color, and remain disabled while offline or reconciling.

### Dialogs and feedback

A native dialog contains the task form and preserves keyboard focus behavior. Loading, save, offline, and synchronization messages remain visible and understandable without depending on color. A save confirmation briefly fades from peach when reduced motion is not requested.

## Do's and Don'ts

### Do:

- **Do** keep actions familiar, labeled, and usable with keyboard and touch.
- **Do** show authoritative save and synchronization feedback in Spanish.
- **Do** allow long task titles and deadlines to wrap.

### Don't:

- **Don't** rely on color alone to convey status or errors.
- **Don't** introduce decorative paper textures that compete with the task list.
