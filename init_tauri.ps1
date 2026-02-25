$env:PATH = "$env:PATH;$($env:USERPROFILE)\.cargo\bin"
npx tauri init --app-name notiz-app --window-title "NotizApp" --frontend-dist ../dist --dev-url http://localhost:5173 --before-dev-command "npm run dev" --before-build-command "npm run build" --force
