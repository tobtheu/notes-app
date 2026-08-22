# Circular Ripple Theme Transition Design

## 1. Overview
This feature introduces a circular ripple transition effect when switching themes (Dark Mode, Sage Green, Clay) in Lama Notes. The animation originates directly from the clicked option or cursor coordinates and expands outwards in a circle across the entire screen in 600ms.

## 2. Requirements & Behavior
- **Origin-based expansion**: The wave starts at the user's click coordinates `(clientX, clientY)`. If triggered via keyboard or without explicit coordinates, it defaults to the center of the clicked button or window center.
- **Full screen coverage**: The target circle radius is computed dynamically using `Math.hypot(max(x, width - x), max(y, height - y))` so the wave fully covers the farthest viewport corner.
- **Duration & Easing**: 600ms with smooth easing `cubic-bezier(0.4, 0, 0.2, 1)`.
- **View Transitions API**: Uses `document.startViewTransition` paired with React `flushSync` for synchronous DOM update capture.
- **Accessibility & Fallback**: Automatically degrades to an instant theme switch if `document.startViewTransition` is not supported or if the user has `prefers-reduced-motion: reduce` enabled.

## 3. Architecture & Changes

### 3.1 Hook: `src/hooks/useTheme.tsx`
- Support an optional `transitionOrigin?: { x: number; y: number }` parameter or event in the theme change handler: `setTheme(theme: Theme, origin?: { x: number; y: number })`.
- In `setTheme`, if `document.startViewTransition` exists and `!window.matchMedia('(prefers-reduced-motion: reduce)').matches`, wrap the state update in `flushSync` and animate the `::view-transition-new(root)` pseudo-element using `clip-path: circle(...)`.
- Apply DOM attributes (`data-theme`, classes) synchronously or inside the transition callback.

### 3.2 UI Component: `src/components/AppearanceSection.tsx`
- Pass `(e: React.MouseEvent)` coordinates to `setTheme(theme, { x: e.clientX, y: e.clientY })` on each theme selector button.

### 3.3 CSS: `src/index.css`
- Disable default cross-fade animation on view transition pseudo elements:
```css
::view-transition-old(root),
::view-transition-new(root) {
  animation: none;
  mix-blend-mode: normal;
}
::view-transition-old(root) {
  z-index: 1;
}
::view-transition-new(root) {
  z-index: 9999;
}
```

## 4. Verification Plan
- Click each theme option in Appearance settings and verify smooth 600ms circular expansion from the exact click location.
- Verify fallback behavior when reduced motion is preferred.
- Run unit & integration test suites (`npm run test`) to ensure no regressions in settings or theme hooks.
