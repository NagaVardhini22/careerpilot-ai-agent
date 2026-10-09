# CareerPilot — Database Migration & Operational Procedures

This document outlines the safety procedures, backup/rollback commands, and step-by-step instructions for executing schema enhancements and data corrections in CareerPilot.

---

## 1. Safety Principles & Safeguards

1. **Idempotence**: The migration runner (`node database/migrate.js`) checks `information_schema.COLUMNS` and `information_schema.STATISTICS` before running any DDL. If a column or index exists, it skips safely without error.
2. **Zero Destructive Operations**: Migrations contain zero `DROP TABLE` or `DROP COLUMN` statements.
3. **Targeted Data Updates**: The skill migration tool does **not** perform bulk updates. It requires human inspection via a read-only preview and explicit confirmation of specific candidate profile IDs (`--candidate-id=<ID> --confirm`).
4. **Isolated Testing**: All migrations are thoroughly tested against an isolated local database copy before being considered for any deployment.

---

## 2. Backup & Rollback Procedures

Always perform a full backup prior to running any database migration or schema modification.

### A. Database Backup (Export)

Replace `$DB_HOST`, `$DB_PORT`, `$DB_USER`, and `$DB_NAME` with your configuration:

```bash
# Export schema and data with timestamps
mysqldump -h $DB_HOST -P $DB_PORT -u $DB_USER -p \
  --single-transaction --quick --routines --triggers \
  $DB_NAME > careerpilot_backup_$(date +%Y%m%d_%H%M%S).sql
```

On Windows PowerShell:
```powershell
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
& "mysqldump.exe" -h localhost -P 3306 -u root -p careerpilot_db > "careerpilot_backup_$timestamp.sql"
```

### B. Rollback / Disaster Recovery (Restore)

To restore from a backup file in the event of an unexpected error:

```bash
mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p $DB_NAME < careerpilot_backup_TIMESTAMP.sql
```

---

## 3. Step-by-Step Migration Execution

### Step 1: Run Safe Schema Migration

Executes non-destructive schema additions (authentication columns, qualification details, legacy flags, nullable skill experience, external job metadata, and indexes):

```bash
node database/migrate.js
```

**Expected Behavior**:
- If columns or indexes do not exist, they are created and logged as `[APPLIED]`.
- If already present, they are logged as `[SKIPPED]` without throwing errors.
- Can be safely re-run at any time.

---

### Step 2: Preview Affected Skill Data (Read-Only)

Audit existing profiles to inspect which records exhibit the onboarding default signature (`Advanced` proficiency and `2.5` years of experience):

```bash
node database/preview_migration.js
```

**Expected Behavior**:
- Reads and prints candidate profiles where every skill was systematically assigned `Advanced` / `2.5`.
- Displays candidate profile IDs, names, emails, and skill lists.
- Modifies zero records.

---

### Step 3: Targeted Skill Migration (Requires Explicit Human Confirmation)

Once a candidate profile has been confirmed as having artificial onboarding values rather than user-entered data, execute the targeted update:

```bash
node database/migrate_skills.js --candidate-id=<CANDIDATE_ID> --confirm
```

**Safety Enforcement**:
- If run without `--candidate-id` or `--confirm`, the command aborts and displays safety instructions.
- Only skills matching the default signature (`Advanced` and `2.5`) for that specific candidate profile are updated to `['Not specified', NULL]`.
- Custom user-entered proficiencies and experience years are strictly preserved.

---

## 4. Migration Files Reference

- [`database/migrations/001_add_auth_and_profile_enhancements.sql`](file:///database/migrations/001_add_auth_and_profile_enhancements.sql): Raw SQL DDL reference.
- [`database/migrate.js`](file:///database/migrate.js): Safe, idempotent migration runner.
- [`database/preview_migration.js`](file:///database/preview_migration.js): Non-destructive audit and preview tool.
- [`database/migrate_skills.js`](file:///database/migrate_skills.js): Targeted, human-confirmed skill data corrector.
