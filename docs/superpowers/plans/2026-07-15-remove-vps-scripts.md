# Clean Up Unused VPS Setup Files Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clean up the repository by removing obsolete VPS setup files (`vps-setup.sh` and `docker-compose.studio.yml`) while keeping local development sync tools.

**Architecture:** Delete the two unused files, and run tests/build to ensure no regressions are introduced.

**Tech Stack:** None (file system clean up)

## Global Constraints
* None

---

### Task 1: Delete Files and Verify

**Files:**
- Delete: `vps-setup.sh`
- Delete: `docker-compose.studio.yml`

**Interfaces:**
- Consumes: None
- Produces: None

* [ ] **Step 1: Delete vps-setup.sh**
  Run: `rm vps-setup.sh`
* [ ] **Step 2: Delete docker-compose.studio.yml**
  Run: `rm docker-compose.studio.yml`
* [ ] **Step 3: Run build to verify Tauri desktop application still compiles**
  Run: `npm run build`
* [ ] **Step 4: Run unit tests to verify no regressions**
  Run: `npm run test`
* [ ] **Step 5: Commit changes**
  Run: `git add . && git commit -m "chore: remove unused vps setup and studio compose files"`
