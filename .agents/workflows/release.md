---
description: Erstellt ein neues Release und pusht es auf GitHub (z.B. /release v0.4.1)
---

Dieser Workflow automatisiert das Erstellen eines neuen Releases. Er aktualisiert die Version in allen relevanten Dateien und setzt den Git-Tag.

**Wichtig:** Der Parameter (z.B. `v0.4.2`) muss beim Aufruf angegeben werden.

1. **Versionsnummer extrahieren**
Verwende die vom User übergebene Version (z.B. `0.4.2`). Falls der User `v0.4.2` schreibt, entferne das `v` für die Dateieinträge, aber behalte es für den Git-Tag.

2. **Version in Dateien aktualisieren**
Aktualisiere das "version"-Feld in:
- `package.json`
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`

3. **Änderungen committen**
// turbo
```bash
git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml
git commit -m "chore: bump version to [VERSION]"
```

4. **Git-Tag erstellen**
Der Tag muss mit `v` beginnen (z.B. `v0.4.2`).
// turbo
```bash
git tag v[VERSION]
```

5. **Pushen**
Pushe den Commit und den Tag, um das GitHub Action Release zu triggern.
// turbo
```bash
git push origin main --tags
```
