---
description: Repair the development environment, including dev server issues and common terminal errors.
---

1. Check terminal output for error messages (e.g., localhost binding issues, port conflicts).
// turbo
2. If it's a port conflict, kill the process using that port.
3. If it's a frontend sync issue, try deleting `node_modules` and running `npm install`.
4. If it's a Tauri/Rust issue, run `cargo clean` and restart the dev server.
5. Verify `src/lib/ipc.ts` or `tauri.conf.json` for correct API endpoints if localhost issues persist.
6. Restart the application with `npm run tauri dev`.
