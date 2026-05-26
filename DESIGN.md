---
name: Mint More
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#3c4a42'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#6c7a71'
  outline-variant: '#bbcabf'
  surface-tint: '#006c49'
  primary: '#006c49'
  on-primary: '#ffffff'
  primary-container: '#10b981'
  on-primary-container: '#00422b'
  inverse-primary: '#4edea3'
  secondary: '#545f73'
  on-secondary: '#ffffff'
  secondary-container: '#d5e0f8'
  on-secondary-container: '#586377'
  tertiary: '#855300'
  on-tertiary: '#ffffff'
  tertiary-container: '#e29100'
  on-tertiary-container: '#523200'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#6ffbbe'
  primary-fixed-dim: '#4edea3'
  on-primary-fixed: '#002113'
  on-primary-fixed-variant: '#005236'
  secondary-fixed: '#d8e3fb'
  secondary-fixed-dim: '#bcc7de'
  on-secondary-fixed: '#111c2d'
  on-secondary-fixed-variant: '#3c475a'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb95f'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
  mint-surface: '#ECFDF5'
  slate-border: '#E2E8F0'
  pure-white: '#FFFFFF'
  text-main: '#0F172A'
  text-muted: '#64748B'
typography:
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  container-max: 1280px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 32px
  sidebar-width: 260px
---

## Brand & Style

The design system embodies a **Modern Corporate** aesthetic tailored for the Indian creative services market. It prioritizes clarity, efficiency, and a sense of premium reliability. Drawing inspiration from the high-whitespace, utility-first approach of global scheduling platforms and the functional density of creative marketplaces, the system balances breathing room with information-dense data visualizations.

The personality is professional yet approachable—designed to instill confidence in business users while remaining flexible enough for creative freelancers. The visual language utilizes high-contrast typography, crisp borders, and a disciplined application of the primary brand color to guide user action and denote "premium" quality without unnecessary decorative flair.

## Colors

The color palette is anchored by **Mint Green**, symbolizing growth and creative "minting." It is used strictly for primary actions and success states. **Deep Slate** provides the necessary weight for structural elements like sidebars and primary headings, ensuring the UI feels grounded. 

**Amber** serves as a strategic accent color for "New" tags, warnings, or premium tier highlights, creating a warm contrast against the cool green and slate. The background strategy utilizes **Pure White** for content cards and **Light Slate (#F8FAFC)** for application backgrounds to subtly define container boundaries without heavy lines.

## Typography

The typography uses a duo-font system to separate brand expression from functional utility. **Plus Jakarta Sans** is used for all headlines to provide a friendly, modern, and distinctively "SaaS" character. **Inter** is utilized for body text and interface labels to ensure maximum legibility at small sizes, especially for data-heavy tables and creative service listings.

When displaying financial data (₹), always use the **Inter** typeface with **tabular-nums** font-feature-settings to ensure vertical alignment of currency values in lists and tables.

## Layout & Spacing

This design system uses a **Fixed Grid** approach for internal dashboards and a **Fluid Grid** for the service marketplace. The spacing rhythm is based on a **4px baseline**, with 16px (4 units) being the standard padding for most cards and components.

### Breakpoints
- **Mobile (< 768px):** Single column layout. Sidebars collapse into a bottom navigation bar or a hamburger menu.
- **Tablet (768px - 1024px):** Condensed sidebar (icons only) and 2-column card grids.
- **Desktop (> 1024px):** Full sidebar with 12-column grid system. Margins expand to 32px to emphasize the "Premium" sense of whitespace.

## Elevation & Depth

Hierarchy is achieved through **Tonal Layers** supplemented by very soft, diffused shadows. Surfaces are not just raised; they are clearly defined by their background contrast.

- **Level 0 (Background):** Slate #F8FAFC.
- **Level 1 (Cards/Sidebar):** White #FFFFFF with a 1px border of #E2E8F0.
- **Level 2 (Hover/Active):** A soft shadow `0px 4px 12px rgba(30, 41, 59, 0.05)` and a subtle increase in border-weight or color intensity.

Avoid heavy shadows or dark gradients. Depth should feel like physical paper layers resting on a clean studio table.

## Shapes

The design system employs a **Rounded** shape language to soften the corporate feel and align with modern creative trends. 

Standard components use a `0.5rem` (8px) radius. However, container-level elements like **Cards and Modals** must use a larger **2xl** (1.5rem / 24px) radius to create the "premium" signature look requested. Buttons and input fields should maintain the standard `0.5rem` to ensure they feel like interactive tools rather than decorative elements.

## Components

### Buttons
- **Primary:** Mint Green (#10B981) background with White text. Use a subtle inner-shadow for a "pressed" feel and a high-contrast hover state that slightly darkens the green.
- **Secondary:** White background with Slate (#1E293B) border and text.
- **Tertiary/Ghost:** No background or border; Deep Slate text. Used for less prominent actions.

### Sidebars
The sidebar uses a Deep Slate (#1E293B) background when "Dark Mode" is applied to the menu, or White with a crisp right-border for "Light Mode." Icons should be stroke-based (2px weight) for a clean, professional look.

### Stat Cards
Dashboard stats should feature a Mint Surface (#ECFDF5) background for the icon container and high-contrast Plus Jakarta Sans for the numerical value. The currency symbol (₹) should be slightly smaller and lighter in weight than the value.

### Inputs & Fields
Clean, White surfaces with #E2E8F0 borders. On focus, the border transitions to Mint Green with a 2px outer glow (ring) of the same color at 20% opacity.

### Data Visualization
Charts should use a palette of Mint, Amber, and Slate. Line charts should use smooth bezier curves rather than sharp angles to match the "rounded" aesthetic.