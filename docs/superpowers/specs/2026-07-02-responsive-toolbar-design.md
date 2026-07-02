# Design Spec: Responsive Editor Toolbar with Overflow Menu

## Goal
Implement a responsive formatting toolbar (`EditorToolbar`) for the Tiptap editor. When the toolbar is too wide for its container (the editor's viewport), it should dynamically hide overflowing buttons from right-to-left and move them into a vertical 3-dot dropdown menu.

## Proposed Design (Option A: Dynamic Measurement)

### Architecture & Layout
1. **Double Container Strategy**:
   - **Measurement Container (Hidden)**: An off-screen, absolute-positioned, `visibility: hidden` container that renders all toolbar items and the 3-dot button to measure their exact widths.
   - **Display Container (Visible)**: The active toolbar displayed to the user, rendering only the items that fit, followed by the 3-dot dropdown button (if any items overflow).

2. **Dynamic Calculation Logic**:
   - Use a `ResizeObserver` (via a ref) to observe the width of the display container's parent or the toolbar itself.
   - On resize or mount, query the width of the display container (`containerWidth`) and the widths of each button from the measurement container.
   - Sum the button widths (plus gaps) from left-to-right.
   - If the total width exceeds the container width, calculate the split point:
     - Reserve space for the 3-dot menu button.
     - Move the remaining buttons that don't fit into the overflow list.
   - Update state with `visibleItemsCount` to trigger a re-render.

3. **Dropdown Menu Component**:
   - Clicking the 3-dot button toggles a floating dropdown menu.
   - The dropdown list displays the overflowing buttons vertically, showing their icon and label text.
   - Clicking an item in the dropdown triggers its formatting action and closes the dropdown.
   - Uses an outside click handler to close the dropdown.

## Verification Plan

### Automated Tests
- Create or update tests for `EditorToolbar` to verify it mounts and renders correctly.

### Manual Verification
- Resize the browser window to verify buttons move to/from the 3-dot menu.
- Click elements in the dropdown to ensure formatting is applied correctly.
- Click outside the dropdown to ensure it closes.
