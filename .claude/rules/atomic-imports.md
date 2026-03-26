# Atomic Import Edits

PostToolUse hooks (biome, eslint, etc.) may auto-delete "unused" imports between sequential edits.

**Always combine import additions with their usage in a single Edit call.**

If the edit is too large for one call:
1. Add the usage/code FIRST (even if it has import errors temporarily)
2. Add the import SECOND — now it's immediately "used" and won't be removed

Never add an import in one Edit and its usage in a separate Edit.