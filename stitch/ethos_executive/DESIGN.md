# Design System Document

## 1. Overview & Creative North Star: "The Merciful Architect"
This design system is built to transform a high-density recruitment dashboard into a "High-End Editorial" experience. Rather than a generic, boxy admin panel, we treat the interface as a curated workspace.

**Creative North Star: The Merciful Architect**
The aesthetic is governed by the concept of *Structured Serenity*. It balances the heavy operational requirements of recruitment (data, tracking, status) with a calm, premium atmosphere. We achieve this by moving away from "standard" UI grids and embracing intentional white space, tonal layering, and sophisticated Arabic typography. We reject the "Template Look" by replacing harsh lines with soft depth and utilizing a "No-Line" philosophy for a more fluid, integrated feel.

---

## 2. Colors: Tonal Depth & Soul
Our palette is rooted in Earth and Sky—charcoal, muted blues, and warm gold accents. This provides a professional foundation that feels grounded and authoritative.

### Palette Highlights
- **Primary (`#26445d`):** A deep, muted blue representing trust and stability.
- **Secondary (`#4c616c`):** A slate grey for supporting elements.
- **Tertiary/Gold (`#563e00`):** Used sparingly for "Premium" moments or high-priority calls to action.
- **Surface Strategy:** We utilize the `surface-container` tiers (`lowest` to `highest`) to create a hierarchy of importance.

### The "No-Line" Rule
Explicitly prohibit 1px solid borders for sectioning. Structural boundaries must be defined solely through background color shifts. For example, a `surface-container-low` data table should sit on a `surface` background. This creates a "seamless" look that feels more modern and high-end than a grid of boxes.

### Signature Textures & Glassmorphism
To add "soul" to the dashboard:
- **Hero CTA/Primary Buttons:** Use a subtle gradient transitioning from `primary` (#26445d) to `primary_container` (#3e5c76).
- **Floating Modals/Overlays:** Use Glassmorphism. Set the background to `surface_container_lowest` at 80% opacity with a `20px` backdrop-blur. This softens the edges and prevents the UI from feeling "pasted on."

---

## 3. Typography: The Arabic-First Hierarchy
Typography is the primary driver of our brand identity. We use **Manrope** for numbers and Latin characters, and **IBM Plex Sans Arabic** for all Arabic text to ensure a technical yet warm feel.

- **Display (Manrope):** High-contrast, bold, used for key metrics and large numbers. It conveys the "Operational" strength of the system.
- **Headline & Title (IBM Plex Sans Arabic):** Semi-bold weights that command attention without being aggressive.
- **Body & Labels:** Optimized for RTL readability. We prioritize the `body-md` (0.875rem) for high-density data to maintain a compact yet legible feel.

**Hierarchy Tip:** Use `on_surface_variant` (#42474d) for labels to create a clear visual distinction between "metadata" and "actual data" (which remains in `on_surface` charcoal).

---

## 4. Elevation & Depth: The Layering Principle
We move beyond shadows to achieve depth. We "stack" our environment.

- **Tonal Layering:** Place a `surface_container_lowest` (#ffffff) card on top of a `surface_container` (#edeeef) background. The contrast in value creates a natural lift.
- **Ambient Shadows:** Only use shadows for interactive floating elements (e.g., dropdowns). Shadows must be extra-diffused: `X: 0, Y: 4, Blur: 24, Opacity: 6%` using a tint of `on_surface`.
- **The "Ghost Border":** For data inputs or status badges where containment is required, use the `outline_variant` (#c3c7cd) at **15% opacity**. This provides a guide for the eye without creating a visual "cage."

---

## 5. Components: Operational Precision
All components prioritize a **compact** footprint to accommodate high information density.

### Buttons & Chips
- **Primary Button:** Gradient-filled (`primary` to `primary_container`), `DEFAULT` (0.25rem) radius for a sharp, professional look.
- **Status Badges (Functional Chips):** 
    - *Approved:* `surface_container_low` with `on_primary_fixed_variant` text.
    - *Pending:* `tertiary_fixed` (#ffdea1) with `on_tertiary_fixed` (#261900) text.
    - *Rejected:* `error_container` with `on_error_container` text.
- **Note:** Badges should use `sm` (0.125rem) roundedness for a "sharp" editorial feel.

### Lists & Data Tables
- **Forbid Divider Lines:** Separate rows using a `2px` vertical gap (Spacing `px` or `0.5`) and a subtle hover state shift to `surface_container_high`.
- **Density:** Use `1.5` (0.3rem) padding for table cells to keep the dashboard compact.

### Input Fields
- **Design:** Minimalist. No full-box borders. Use a `surface_container_highest` bottom-border only (2px) or a very faint "Ghost Border."
- **Focus State:** Transition the bottom border to `primary` with a soft glow effect.

### Custom Component: The "Candidate Card"
A signature component for this system. A `surface_container_lowest` container with a `primary_fixed_dim` left-accent bar (RTL: right-accent) to denote "Selected" status. This uses color-coding to convey information without adding text noise.

---

## 6. Do's and Don'ts

### Do:
- **Use Intentional Asymmetry:** In the layout, align the main data table to the right (RTL), but allow the sidebar or "quick stats" to have varying heights to create a dynamic, editorial feel.
- **Embrace White Space:** Even in high-density views, use the Spacing Scale (specifically `8` and `10`) to let main sections breathe.
- **Prioritize Numbers:** In recruitment, numbers matter. Use `display-sm` for "Total Candidates" or "Open Roles."

### Don't:
- **Don't use 100% Black:** Always use `on_surface` (Charcoal) for text to keep the "Calm" aesthetic.
- **Don't use "System" Shadows:** Avoid the default CSS `box-shadow: 0 2px 4px rgba(0,0,0,0.5)`. It is too heavy for this premium system.
- **Don't use Rounded Corners for Everything:** Avoid the "Pill" shape for buttons. Stick to `DEFAULT` (4px) or `md` (6px) to maintain a professional, architectural tone.
- **No Noisy Gradients:** Gradients should be nearly imperceptible, used only to add depth to flat surfaces.