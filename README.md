# db-cli — PMI SQL Server CLI

A read-only command-line tool for querying PMI's SQL Server databases by named profile. No raw connection strings, no accidental writes.

---

## Prerequisites

| Requirement | Minimum | Notes |
|---|---|---|
| Node.js | v18+ | [nodejs.org](https://nodejs.org) — LTS recommended |
| npm | v9+ | Included with Node.js |
| Network | Internal LAN | Must be able to reach the SQL Server host |
| SQL Server access | Read account | Credentials shared by your team lead |

Check you have what you need:

```bash
node --version   # should print v18.x or higher
npm --version    # should print 9.x or higher
```

---

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/pmi-copilot/database-cli.git
cd database-cli
```

### 2. Install dependencies

```bash
npm install
```

### 3. Build the CLI

```bash
npm run build
```

### 4. Register `db-cli` as a global command

```bash
npm link
```

Verify it worked:

```bash
db-cli --help
```

---

## Configuration

The CLI reads connection settings from a `.env` file in the project root.

### Create your `.env`

```bash
cp config/env.example .env
```

Open `.env` and fill in the credentials (get these from your team lead):

```env
# SQL Server connection — same server for all profiles
DB_SERVER=your-sql-server-host
DB_USER=your-username
DB_PASSWORD=your-password
DB_PORT=1433
DB_ENCRYPT=false
DB_TRUST_SERVER_CERTIFICATE=true

# Database profiles
DB_TENANT=dev_pmi_nch
DB_GLOBAL=pmi_global
DB_ADMIN=pmi_admin
DB_GOGREEN=dev_pmi_gogreen
DB_QUEUE=pmi_queue
```

> **Important:** `.env` is gitignored and will never be committed. Keep your credentials in it only.

Verify your connection:

```bash
db-cli --list-profiles
```

Expected output:

```
Configured database profiles:

  tenant       → dev_pmi_nch
  global       → pmi_global
  admin        → pmi_admin
  gogreen      → dev_pmi_gogreen
  queue        → pmi_queue
```

---

## Usage

Every command follows the same pattern:

```
db-cli <profile> <command> [options]
```

### Profiles

| Profile | Database | What's in it |
|---|---|---|
| `tenant` | dev_pmi_nch | Per-hotel data — cockpits, forecasting, labour, rosters |
| `global` | pmi_global | Cross-hotel shared data — users, groups, hierarchy |
| `admin` | pmi_admin | Admin and configuration tables |
| `gogreen` | dev_pmi_gogreen | Environmental and sustainability data |
| `queue` | pmi_queue | Job queue and task scheduling |

---

## Command Reference

### Explore a table

```bash
# Schema + 3 sample rows in one call — best starting point for any unknown table
db-cli tenant preview --table tbl_global_hierarchy

# Schema only
db-cli tenant describe-table --table Cockpit_Master

# Indexes on a table
db-cli tenant list-indexes --table Cockpit_Master

# Constraints (PK, FK, unique, check)
db-cli tenant list-constraints --table Cockpit_Master
```

### Query data

```bash
# Default JSON output
db-cli tenant read-query --query "SELECT TOP 10 * FROM tbl_global_hierarchy"

# Human-readable table output
db-cli tenant read-query \
  --query "SELECT TOP 10 hierarchy_id, hierarchy_name FROM tbl_global_hierarchy" \
  --format table

# Export to CSV
db-cli tenant export-query \
  --format csv \
  --query "SELECT * FROM tbl_global_hierarchy WHERE hierarchy_parent_id = 0"
```

### List database objects

```bash
db-cli tenant list-tables
db-cli tenant list-views
db-cli tenant list-functions
db-cli tenant list-sp
db-cli tenant list-triggers
```

### Inspect object definitions

```bash
# View the SQL definition of any object
db-cli tenant describe-view     --view     Aggregated.FB_Aggregated_Labor_Department_Day
db-cli tenant describe-function --function dbo.MyFunction
db-cli tenant describe-sp       --sp       Aggregated.Aggregate_Arrival_Departure_Get_Day
db-cli tenant describe-trigger  --trigger  SnapShot
```

### Execute stored procedures

```bash
# No parameters
db-cli tenant exec-sp --sp dbo.GetHotelSummary

# With parameters (JSON object)
db-cli tenant exec-sp \
  --sp Aggregated.Aggregate_Arrival_Departure_Get_Day \
  --params '{"FromDate":"2025-01-01","ToDate":"2025-01-31","h_id":10}'
```

---

## PMI Data Patterns

### How hotels and departments are structured

All hotels and their departments live in `tbl_global_hierarchy` in the **tenant** database. It is a parent-child tree — not a flat hotel list.

```
tbl_global_hierarchy
├── Hotel 1  (hierarchy_parent_id = 0, hierarchy_level = 1)
│   ├── Reception  (hierarchy_parent_id = 1)
│   ├── Restaurant (hierarchy_parent_id = 1)
│   └── Kitchen    (hierarchy_parent_id = 1)
├── Hotel 2  (hierarchy_parent_id = 0, hierarchy_level = 1)
│   └── ...
```

Key columns:

| Column | Meaning |
|---|---|
| `hierarchy_id` | Unique ID for any node (hotel or department) |
| `hierarchy_parent_id` | Parent's ID — `0` means top-level hotel |
| `hierarchy_level` | `1` = hotel, `NULL` = department |
| `hierarchy_income_level` | `1` = revenue node, `0` = cost/department |
| `hierarchy_available_rooms` | Room count (hotels only) |
| `hierarchy_division_name` | Primary division: `room`, `fb`, etc. |

### Common queries

**List all hotels:**
```bash
db-cli tenant read-query --format table \
  --query "SELECT hierarchy_id, hierarchy_name, hierarchy_available_rooms
           FROM tbl_global_hierarchy
           WHERE hierarchy_parent_id = 0 AND hierarchy_level = 1
           ORDER BY hierarchy_id"
```

**Departments under a hotel (e.g. hotel 10):**
```bash
db-cli tenant read-query --format table \
  --query "SELECT hierarchy_id, hierarchy_name, hierarchy_division_name
           FROM tbl_global_hierarchy
           WHERE hierarchy_parent_id = 10"
```

**Labour actuals for hotel 10, last 7 days:**
```bash
db-cli tenant read-query --format table \
  --query "SELECT date, h_id, productive, non_prod, budget
           FROM Cockpit_Labour_Values
           WHERE h_id IN (
               SELECT hierarchy_id FROM tbl_global_hierarchy
               WHERE hierarchy_parent_id = 10
           )
           AND date >= DATEADD(day, -7, GETDATE())
           ORDER BY date DESC"
```

**Forecasting values for hotel 10:**
```bash
db-cli tenant read-query --format table \
  --query "SELECT date, units_rolling, guests_rolling, revenue_rolling
           FROM Forecasting_Values
           WHERE h_id = 10
           AND date BETWEEN '2025-01-01' AND '2025-01-31'
           ORDER BY date"
```

**Active users (global database):**
```bash
db-cli global read-query --format table \
  --query "SELECT user_id, user_name, user_email
           FROM tbl_global_user
           WHERE user_active = 1
           ORDER BY user_name"
```

---

## What Is Blocked

This CLI is **read-only**. The following are rejected before reaching the database:

- Write statements: `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`
- Schema changes: `CREATE`, `ALTER`, `DROP`
- Table creation via select: `SELECT INTO`
- External data sources: `OPENROWSET`, `OPENDATASOURCE`, `OPENQUERY`
- Batched statements: any query containing `;`
- Dangerous system procedures: `sp_executesql`, `xp_cmdshell`, and others

Stored procedures may contain internal write logic — executing a stored procedure with `exec-sp` is allowed because the SP itself is a trusted database object.

---

## Troubleshooting

**`db-cli: command not found`**

Run `npm link` again from the project directory:
```bash
cd /path/to/database-cli
npm link
```

**`No database profiles configured`**

The CLI cannot find your `.env`. Make sure it exists in the project root:
```bash
ls -la /path/to/database-cli/.env
```

**`Failed to connect to SQL Server`**

- Check you are on the internal network or VPN
- Verify your credentials in `.env` are correct
- Confirm the port is reachable: `telnet <DB_SERVER> 1433`

**TLS deprecation warning**

```
DeprecationWarning: Setting the TLS ServerName to an IP address is not permitted by RFC 6066
```

This is a cosmetic Node.js warning when connecting to an IP address directly. The connection works normally — no action required.

**After pulling new changes**

```bash
cd /path/to/database-cli
git pull
npm install
npm run build
```

No need to re-run `npm link` — the global command already points to this directory.

---

## Adding a New Database Profile

Open your `.env` and add a line:

```env
DB_MYPROFILE=MyDatabaseName
```

The profile is immediately available — no rebuild required:

```bash
db-cli myprofile list-tables
```

---

## For AI Agents (Claude Code)

This repo includes a `SKILL.md` that registers `db-cli` as a Claude Code skill. Once installed, agents can use all commands above directly without setup. See `SKILL.md` for the full skill definition.

---

## Repository

[https://github.com/pmi-copilot/database-cli](https://github.com/pmi-copilot/database-cli)
