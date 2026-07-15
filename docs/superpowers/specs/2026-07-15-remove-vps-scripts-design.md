# Design Spec — Remove Unused VPS Setup Files

**Date:** 2026-07-15
**Status:** Proposed

## Goal
Clean up the repository by removing obsolete VPS setup files that are no longer used or needed for the Tauri app client.

## Scope

### Files to Delete
*   `vps-setup.sh` — Obsolete bash setup script for VPS provisioning.
*   `docker-compose.studio.yml` — Obsolete Supabase Studio docker setup for VPS.

### Files to Keep
*   `docker-compose.yml` — Used for running local ElectricSQL instances during sync development.
*   `supabase/migrations/001_electric_setup.sql` — Required schema definitions for ElectricSQL database configurations.

## Risks & Verification
*   **Risk:** Deleting development assets.
*   **Mitigation:** Verified that the frontend application does not import or depend on `vps-setup.sh` or `docker-compose.studio.yml`. Verification commands:
    *   Ensure build still passes: `npm run build`
    *   Ensure tests still pass: `npm run test`
