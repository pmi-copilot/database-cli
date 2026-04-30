# db-cli Skill

Read-only SQL Server CLI with named database profiles. Use this skill whenever you need to query or inspect SQL Server databases. All write/DDL operations are blocked.

## Setup (one-time)

Copy `config/env.example` to `.env` in the project root and fill in your credentials.

```
DB_SERVER=your-sql-server-host
DB_USER=your-username
DB_PASSWORD=your-password
DB_PORT=1433
DB_ENCRYPT=true
DB_TRUST_SERVER_CERTIFICATE=false

DB_TENANT=TenantDB
DB_GLOBAL=GlobalDB
DB_ADMIN=AdminDB
DB_GOGREEN=GoGreenDB
```

## Available profiles

| Profile  | Contents                                                  |
|----------|-----------------------------------------------------------|
| tenant   | Per-hotel data — cockpits, forecasting, labour, rosters  |
| global   | Cross-hotel shared data — users, groups, hierarchy        |
| admin    | Admin / configuration tables                              |
| gogreen  | Environmental / sustainability data                       |
| queue    | PMI queue / job processing data                           |

## Command reference

```bash
db-cli --list-profiles
db-cli --help
```

### Explore a table (start here)
```bash
# Schema + 3 sample rows in one call — use this before querying an unknown table
db-cli <profile> preview --table <table>

# Schema only
db-cli <profile> describe-table --table <table>

# Indexes and constraints
db-cli <profile> list-indexes     --table <table>
db-cli <profile> list-constraints --table <table>
```

### Query data
```bash
# JSON output (default)
db-cli <profile> read-query --query "SELECT TOP 10 * FROM <table>"

# Human-readable table output
db-cli <profile> read-query --query "SELECT TOP 10 * FROM <table>" --format table

# Export
db-cli <profile> export-query --format csv   --query "SELECT * FROM <table>"
db-cli <profile> export-query --format json  --query "SELECT * FROM <table>"
db-cli <profile> export-query --format table --query "SELECT * FROM <table>"
```

### Browse objects
```bash
db-cli <profile> list-tables
db-cli <profile> list-views
db-cli <profile> list-functions
db-cli <profile> list-sp
db-cli <profile> list-triggers

db-cli <profile> describe-view     --view     <schema.name>
db-cli <profile> describe-function --function <schema.name>
db-cli <profile> describe-sp       --sp       <schema.name>
db-cli <profile> describe-trigger  --trigger  <name>
```

### Execute stored procedures
```bash
db-cli <profile> exec-sp --sp <schema.name>
db-cli <profile> exec-sp --sp <schema.name> --params '{"Param1":"value","Param2":10}'
```

## What is blocked

Direct write SQL issued by the caller:
`INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `CREATE`, `ALTER`, `DROP`,
`SELECT INTO`, `OPENROWSET`, `OPENDATASOURCE`, `OPENQUERY`, batched statements (`;`)

Stored procedures may contain internal write logic — that is not blocked, as the SP is a trusted DB object.

## PMI data patterns (cheat-sheet)

### Hotel / hierarchy model

All hotels and departments live in `tbl_global_hierarchy` (tenant db).

```sql
-- Top-level hotels: hierarchy_parent_id = 0
SELECT hierarchy_id, hierarchy_name, hierarchy_available_rooms
FROM tbl_global_hierarchy
WHERE hierarchy_parent_id = 0 AND hierarchy_level = 1

-- Departments under a hotel (hierarchy_id = 10)
SELECT hierarchy_id, hierarchy_name, hierarchy_division_name
FROM tbl_global_hierarchy
WHERE hierarchy_parent_id = 10

-- Full tree for a hotel (hotel + all its departments)
SELECT hierarchy_id, hierarchy_name, hierarchy_parent_id, hierarchy_level
FROM tbl_global_hierarchy
WHERE hierarchy_id = 10 OR hierarchy_parent_id = 10
```

Key columns:
| Column | Meaning |
|---|---|
| `hierarchy_id` | Unique ID for any node (hotel or dept) |
| `hierarchy_parent_id` | Parent node; `0` = top-level hotel |
| `hierarchy_level` | `1` = hotel, `NULL` = department |
| `hierarchy_income_level` | `1` = revenue node, `0` = cost/dept node |
| `hierarchy_available_rooms` | Room count (hotels only) |
| `hierarchy_division_name` | Primary division: `room`, `fb`, etc. |

### Cockpit labour values

```sql
-- Labour actuals for hotel 10, last 7 days
SELECT date, h_id, productive, non_prod, budget
FROM Cockpit_Labour_Values
WHERE h_id IN (
    SELECT hierarchy_id FROM tbl_global_hierarchy WHERE hierarchy_parent_id = 10
)
AND date >= DATEADD(day, -7, GETDATE())
ORDER BY date DESC
```

### Forecasting values

```sql
-- Forecasted room nights for hotel 10
SELECT date, units_rolling, guests_rolling, revenue_rolling
FROM Forecasting_Values
WHERE h_id = 10
AND date BETWEEN '2025-01-01' AND '2025-01-31'
ORDER BY date
```

### Global users

```sql
-- Users (global db)
SELECT user_id, user_name, user_email, user_active
FROM tbl_global_user
WHERE user_active = 1
```

### Cross-database note

`tbl_global_hierarchy` lives in **tenant** but users live in **global**. Joining them requires two separate CLI calls — run the hierarchy query first, collect the IDs, then query global. Linked-server cross-db joins are not supported by this CLI.

## Connection overrides (per command)

```bash
db-cli tenant list-tables --server otherserver --user otheruser --password otherpass
```
