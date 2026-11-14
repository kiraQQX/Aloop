# Aloop Design System — Research Blue

## Design direction
Aloop is a psychology and online research platform. Its visual identity combines an immersive blue research landscape with a bright, low-saturation interface for tools and experiment participation. The homepage uses an interactive tetrahedral particle cortex (both hemispheres) over a blue-and-white contour map, and the beLieve data-sea scene; utility pages prioritize legibility, restrained hierarchy, and low-friction tasks.

## Color tokens

| Token | Value | Role |
|---|---|---|
| Brand primary | `#315E91` | Primary actions, links, progress, selected controls |
| Brand deep | `#23466D` | Dark hero, navigation surface, high-contrast hover states |
| Brand secondary blue | `#477EAE` | Supporting charts, particle detail, secondary emphasis |
| Accent yellow | `#F2CC4D` | Brain-region highlights, key markers, selected signals and warning emphasis |
| EasySci marker yellow | `#FFD84D` | Resource-name marker and official-site hover, pressed and keyboard-focus states; use dark foreground text |
| Auxiliary cyan | `#5AB7BD` | Neural connections, data-sea details and secondary interactive signals |
| Page background | `#F5F7FA` | Research tools and experiment runtime canvas |
| Card surface | `#FFFFFF` | Forms, catalogue cards and reading surfaces |
| Primary text | `#253449` | Headings and body copy on light surfaces |
| Secondary text | `#5E6D82` | Descriptions, metadata and helper text |
| Border | `#DCE4ED` | Inputs, cards and separators |
| Strong border | `#BAC8D9` | Default form boundary and secondary controls |
| Success | `#237A57` | Successful action/status |
| Error | `#B42332` | Validation errors and storage warnings |

## Application rules
- The fixed header uses deep blue with white navigation text so it remains readable above both light pages and the hero.
- The page canvas is a static blue-and-white contour map (`assets/img/contours.svg`, built by `tests/build_contours.py`) on a white-to-`#EEF4FB` gradient; hero text uses `#253449`. The hero visual is a GPU-instanced cloud of regular tetrahedra sampled from the cortical surfaces of both hemispheres, coloured with the `--pt-*` tokens (`#1B3A66`, `#315E91`, `#477EAE`, `#3A9FA8`, with `#F2CC4D` only as click-wave highlight). Experiment showcase sections keep their deep-blue data-sea scenes.
- EasySci, login/register surfaces, and experiment runtime pages use white and pale blue-gray surfaces with dark text.
- Primary buttons use `#315E91` with white text. Hover and focus fill use `#23466D`; cyan is not used behind small white button labels because its contrast is insufficient.
- Yellow is a selective signal, not a general surface color. Use dark text on yellow backgrounds. EasySci uses the dedicated `--accent-yellow: #FFD84D` token for resource-name markers and interaction feedback; keep the existing `#F2CC4D` brain and hero signal color unchanged.
- Cyan is reserved for auxiliary interaction and visualization; small text on cyan/white backgrounds must use a sufficiently dark foreground.
- Selected items combine a tinted background, border, and state attribute or icon. Color is never the only indicator of state.
- Existing routes, language switching, experiment entry, local session storage, login modal, data-sea particle interactions and EasySci filtering must remain intact. The cortical model has separate 3D drag/zoom/select controls and a clear failure state.

## Accessibility
For normal-size text, target WCAG AA contrast of at least 4.5:1; for large text, at least 3:1. `#315E91` and `#23466D` are used for white-on-color action/navigation surfaces. Use `#253449` on yellow and light surfaces. Avoid white text on `#F2CC4D` or `#5AB7BD`; these combinations do not provide sufficient contrast for normal text. Focus rings, disabled state, validation status and selection state must remain visibly distinguishable.

## Typography, spacing and motion
Keep the established responsive type scale and spacing system unless a content-specific issue requires change. Chinese content uses the available system CJK sans-serif fallback; Latin content uses the existing neutral sans-serif stack. Preserve the interactive brain response, slow data-sea movement, keyboard activation, reduced-motion support and mobile-specific layouts. Decorative motion must not obscure experiment controls or copy.
