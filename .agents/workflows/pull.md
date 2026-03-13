---
description: Führe einen git pull aus und behandle Konflikte automatisch durch teilweises Zurücksetzen.
---

1. Check current git status to ensure the working directory is clean.
// turbo
2. Run `git pull`.
3. If conflicts occur:
    - Automatically run `git restore --source=HEAD :/` to discard remote changes and keep local versions.
    - Or resolve via `git merge --abort` if appropriate.
4. Finalize by ensuring the application state is consistent.
