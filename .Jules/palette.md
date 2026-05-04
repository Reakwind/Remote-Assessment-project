## 2026-05-04 - Semantic Lists for Accessibility
**Learning:** Using semantic lists (`<ol>` and `<li>`) for instructions, even when custom visual list numbers are used, provides a better screen reader experience by grouping the steps naturally. Adding `list-none m-0 p-0` prevents the native browser styling from clashing with the custom design while retaining the accessibility benefits.
**Action:** Always favor semantic HTML tags like `<ol>` and `<li>` for sequential steps over `<div>` wrappers, and use utility classes to reset their styles if visual markers are custom.
