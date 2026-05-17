# Putman Database Scripts Reference

This folder contains the official SQL scripts for the Putman API Client architecture.

## 📂 /main-db/ (Master Project)
**Action:** Execute `01-main-setup.sql` in your **Main Supabase Project** SQL Editor.
- This project handles authentication and user onboarding.
- It contains the `init_scripts` table which stores the tenant schemas.
- It identifies which users belong to which teams.

## 📂 /tenant-db/ (Child Projects)
**Action:** These scripts are automatically applied by the app during the "Smart Initialize" flow.
- Use `01-tenant-setup.sql` if you want to manually prepare a tenant database.
- This defines the standard workspace/collection/request schema for isolation.

---
**Note:** Ensure the `execute_sql` helper function is installed in all databases to enable automatic schema updates from the UI.
