# db-cli Skill

Read-only SQL Server CLI with named database profiles. Use this skill whenever you need to query or inspect SQL Server databases. All write/DDL operations are blocked.

## Setup (one-time)

Connection settings are read from `.env` in the project root (auto-loaded — no flags needed).

**Environment variables** (`.env`):
```
DB_SERVER=10.61.3.100
DB_USER=pmi_dev
DB_PASSWORD=<password>
DB_PORT=1433
DB_ENCRYPT=false
DB_TRUST_SERVER_CERTIFICATE=true

DB_TENANT=dev_pmi_nch
DB_GLOBAL=pmi_global
DB_ADMIN=pmi_admin
DB_GOGREEN=dev_pmi_gogreen
```

**Or a JSON config file** at `./config/databases.json`:
```json
{
  "server": "10.61.3.100",
  "user": "pmi_dev",
  "password": "<password>",
  "databases": {
    "tenant": "dev_pmi_nch",
    "global": "pmi_global",
    "admin": "pmi_admin",
    "gogreen": "dev_pmi_gogreen"
  }
}
```

## Available profiles

| Profile  | Database        | Contents                                     |
|----------|-----------------|----------------------------------------------|
| tenant   | dev_pmi_nch     | Per-hotel data (cockpits, forecasting, labour, rosters) |
| global   | pmi_global      | Cross-hotel shared data (users, groups, hierarchy) |
| admin    | pmi_admin       | Admin / configuration tables                 |
| gogreen  | dev_pmi_gogreen | Environmental / sustainability data          |

## Command reference

### General
```bash
db-cli --list-profiles          # show all configured profiles
db-cli --help                   # show full help
```

### Queries (SELECT only — no write SQL allowed)
```bash
db-cli <profile> read-query --query "SELECT TOP 10 * FROM tbl_global_hierarchy"
db-cli <profile> export-query --format csv  --query "SELECT * FROM tbl_global_user"
db-cli <profile> export-query --format json --query "SELECT * FROM tbl_global_user"
```

### Tables
```bash
db-cli <profile> list-tables
db-cli <profile> describe-table --table Cockpit_Master
db-cli <profile> list-indexes      --table Cockpit_Master
db-cli <profile> list-constraints  --table Cockpit_Master
```

### Views
```bash
db-cli <profile> list-views
db-cli <profile> describe-view --view dbo.MyView
db-cli <profile> describe-view --view "Aggregated.FB_Aggregated_Labor_Department_Day"
```

### Stored Procedures
```bash
db-cli <profile> list-sp
db-cli <profile> describe-sp --sp dbo.MyProc
db-cli <profile> describe-sp --sp "Aggregated.MyProc"
db-cli <profile> exec-sp     --sp dbo.MyProc
db-cli <profile> exec-sp     --sp dbo.MyProc --params '{"HotelId":10,"FromDate":"2025-01-01"}'
```

### Functions
```bash
db-cli <profile> list-functions
db-cli <profile> describe-function --function dbo.MyFunction
```

### Triggers
```bash
db-cli <profile> list-triggers
db-cli <profile> describe-trigger --trigger SnapShot
```

## What is blocked

Direct SQL write operations issued by the caller:
- `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`
- `CREATE`, `ALTER`, `DROP`
- Batched statements (semicolons)

Stored procedures may contain write logic internally — that is not blocked, as the SP is a trusted DB object.

## Connection overrides (per command)

Override `.env` for a single invocation:
```bash
db-cli tenant list-tables --server otherserver --user otheruser --password otherpass
```
