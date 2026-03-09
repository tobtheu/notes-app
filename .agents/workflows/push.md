---
description: Committe und pushe die aktuelle stabile Version
---

Dieser Workflow hilft dabei, die aktuellen Änderungen sauber zu speichern und auf das Remote-Repository zu übertragen.

1. **Status prüfen**
```bash
git status
```

2. **Änderungen stagen**
// turbo
```bash
git add .
```

3. **Commit erstellen**
Verwende eine aussagekräftige Nachricht. Empfohlene Nachricht für die aktuellen Stabilitäts-Fixes:
`fix: eliminate wild duplicates & stabilize editor selection during sync`

// turbo
```bash
git commit -m "fix: eliminate wild duplicates & stabilize editor selection during sync"
```

4. **Änderungen pushen**
// turbo
```bash
git push
```
