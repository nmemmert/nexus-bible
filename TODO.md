# TODO

## UX and Link Behavior
- Wire the App header "Quick search" to either the current chapter search or the global search page (show results + clear state).
- Hook up Reader header actions ("Share", "Bookmark", "Listen") to actual behavior or remove until implemented.
- Make "Recently opened" items actionable (navigate to passage) or remove the panel to avoid dead UI.
- Make tool cards and their "Open" buttons use explicit navigation (links or button onClick) for accessibility; right now the card is clickable but the button has no handler.
- Update Notes tabs to push the selected tab into the URL query (so refresh/deep link keeps the active tab in sync).
- Consider linking search results to a verse anchor (or add a verse highlight) so users land on the exact verse.

## Visual Consistency
- Normalize header/action layouts across routes (some sections use the header CTA row while others are text-only); decide on a standard layout for all routes.
- Align spacing and panel widths across Reader/Library/Notes/Tools so each route lands on a consistent content grid.
- Audit button styles (ghost vs primary) for consistent CTA hierarchy in Tools and Notes lists.
