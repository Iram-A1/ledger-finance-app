# Ledger - Personal Finance Tracker

Ledger is a personal finance tracking web application for tracking money
available, savings, credit card debt, available credit, spending,
transfers, notes, budgets, and recurring transactions.

> **Project status:** Active development

## Purpose

Ledger is designed to provide one simple place to track:

-   Bank and cash balances
-   Savings
-   Credit card debt and available credit
-   Daily, monthly, and yearly spending
-   Spending categories
-   Transfers between accounts
-   Transaction notes
-   Budgets
-   Recurring transactions

The goal is fast, simple data entry while preserving useful financial
history.

## Main Features

### Dashboard

The dashboard shows:

-   Money Available
-   Total Savings
-   Credit Card Debt
-   Available Credit
-   Spending This Month
-   Net Position
-   Recent Transactions

Net Position:

`Cash + Savings - Credit Card Debt`

Available credit is not treated as money owned and is excluded from net
position.

### Accounts

Supported account types:

-   Cash / Bank
-   Savings
-   Credit Cards

Credit card accounts can track credit limit, current debt, and available
credit.

`Available Credit = Credit Limit - Current Debt`

### Transactions

Supported transaction types include:

-   Expense
-   Income / Add Money
-   Transfer
-   Add to Savings
-   Withdraw from Savings
-   Credit Card Purchase
-   Credit Card Payment
-   Manual Adjustment

Transactions can contain amount, date, account, category, description,
merchant, and notes.

### Financial Rules

1.  Transfers between personal accounts are not expenses.
2.  Credit card purchases increase debt and count as spending.
3.  Credit card payments reduce debt but do not count as spending again.
4.  Savings transfers are not expenses.
5.  Available credit is not money owned.
6.  Balance-changing activity should preserve financial history.

### Categories and Spending

Ledger includes common categories such as groceries, restaurants, gas,
transportation, housing, utilities, phone/internet, shopping, childcare,
health, education, entertainment, subscriptions, travel, bills, gifts,
and miscellaneous.

Custom categories can also be created.

Spending can be reviewed for today, this week, this month, and this
year. Monthly category budgets can be configured.

### Notes

Notes can contain a title, description, date, related account, amount,
and tag. They can be used to explain where money came from or why a
balance changed.

### Recurring Transactions

Recurring activity can include rent, phone bills, subscriptions, regular
savings, recurring income, and credit card payments.

### Reports, Export and Backup

Current data features include:

-   Excel (.xlsx) export
-   CSV transaction export
-   JSON backup
-   JSON restore

Keep periodic backups of important financial information.

## Technology

-   React
-   Vite
-   JavaScript / JSX
-   Tailwind CSS
-   Lucide React
-   SheetJS / XLSX
-   GitHub for source control
-   Vercel for deployment
-   Supabase planned for authentication and cloud synchronization

## Project Structure

``` text
ledger-finance-app/
├── public/
│   ├── icon-192.png
│   ├── icon-512.png
│   └── manifest.webmanifest
├── src/
│   ├── App.jsx
│   ├── index.css
│   └── main.jsx
├── README.md
├── index.html
├── package.json
└── vite.config.js
```

### Important Files

**`src/App.jsx`** is the main application file containing most of the
interface and financial logic.

**`src/main.jsx`** starts the React application.

**`src/index.css`** contains global styling and Tailwind setup.

**`package.json`** defines dependencies and build commands.

**`vite.config.js`** contains the Vite configuration.

**`index.html`** is the main HTML entry point.

## Running Locally

``` bash
npm install
npm run dev
```

Production build:

``` bash
npm run build
```

The production output is generated in `dist/`.

## Deployment

``` text
Code
  ↓
GitHub
  ↓
Vercel
  ↓
Ledger Web App / PWA
```

GitHub commits can trigger new Vercel deployments after the repository
is connected.

## Mobile Access

Ledger is designed to be mobile responsive. The goal is to make it a
Progressive Web App (PWA), allowing it to be installed on a phone Home
Screen without requiring an app-store release.

## Current Data Storage

**Important:** Cloud synchronization has not yet been completed.

Outside its original environment, Ledger can fall back to browser local
storage. Data stored in one browser may therefore not automatically
appear on another device. Clearing browser/site data can also remove
locally stored information.

Until cloud synchronization is completed:

-   Keep backups.
-   Do not assume data is synchronized between devices.
-   Do not rely on browser storage as the only copy of important
    financial information.

## Planned Cloud Architecture

``` text
Phone
   │
   ↓
Ledger
   │
   ↓
Supabase
   ↑
   │
Ledger
   ↑
   │
Laptop
```

Supabase is planned to provide authentication, private user accounts, a
cloud database, and cross-device synchronization.

Row Level Security (RLS) should be enabled so authenticated users can
access only their own financial data.

## Security

Do not store:

-   Online banking passwords
-   PINs
-   Full credit/debit card numbers
-   CVV/security codes
-   Government identification numbers
-   Authentication codes
-   Banking security answers

Use account nicknames rather than full account/card numbers.

Expected Supabase client environment variables:

``` text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Never commit privileged credentials such as a Supabase `service_role`
key.

## Development Roadmap

### Phase 1 - Core Application

-   [x] Dashboard
-   [x] Account management
-   [x] Transaction tracking
-   [x] Savings tracking
-   [x] Credit card tracking
-   [x] Spending categories
-   [x] Notes
-   [x] Budgets
-   [x] Recurring transactions
-   [x] Excel export
-   [x] CSV export
-   [x] JSON backup/restore
-   [x] Mobile-responsive interface

### Phase 2 - Deployment

-   [x] Create GitHub repository
-   [x] Create Vite project structure
-   [ ] Verify successful production build
-   [ ] Deploy to Vercel
-   [ ] Test mobile deployment

### Phase 3 - Authentication & Cloud Sync

-   [ ] Create Supabase project
-   [ ] Create database
-   [ ] Enable Row Level Security
-   [ ] Add Supabase client
-   [ ] Add email/password authentication
-   [ ] Replace browser-only storage with cloud synchronization
-   [ ] Test synchronization between phone and laptop
-   [ ] Test logout/login and account isolation

### Phase 4 - PWA

-   [ ] Finalize manifest
-   [ ] Finalize app icons
-   [ ] Add service worker/PWA configuration
-   [ ] Test Android installation
-   [ ] Test standalone display
-   [ ] Test updates after deployments

### Phase 5 - Quality & Security

-   [ ] Test transaction calculations
-   [ ] Test credit card calculations
-   [ ] Test transfers and savings transfers
-   [ ] Test transaction editing/deletion
-   [ ] Test Excel export and backup/restore
-   [ ] Test mobile responsiveness
-   [ ] Test authentication and database security
-   [ ] Review error handling

## Financial Logic Test

Starting balances:

``` text
CIBC Chequing: $2,000
RBC Savings: $700
CIBC Visa:
  Credit Limit: $3,000
  Debt: $500
  Available Credit: $2,500
```

Spend \$100 on groceries from CIBC Chequing.

Expected:

``` text
CIBC Chequing = $1,900
Spending = $100
```

Transfer \$500 from CIBC Chequing to RBC Savings.

Expected:

``` text
CIBC Chequing = $1,400
RBC Savings = $1,200
Spending = $100
```

Spend \$200 using CIBC Visa.

Expected:

``` text
Credit Card Debt = $700
Available Credit = $2,300
Total Spending = $300
```

Pay \$300 from CIBC Chequing toward CIBC Visa.

Expected:

``` text
CIBC Chequing = $1,100
Credit Card Debt = $400
Available Credit = $2,600
Total Spending = $300
```

If these results do not match, fix the financial logic before relying on
the application.

## Recovery Notes for Future Me

If returning to this project later:

1.  Read this README first.
2.  Check the latest GitHub commit.
3.  Check the latest Vercel deployment/build log.
4.  Determine whether Supabase synchronization has been completed.
5.  Do not assume local browser data is synchronized.
6.  Back up existing data before major changes.
7.  Make one meaningful change at a time.
8.  Commit it to GitHub.
9.  Allow Vercel to rebuild.
10. Test on mobile.
11. If something breaks, inspect the actual error before changing
    unrelated files.

## Development Loop

``` text
Build
  ↓
Test
  ↓
Inspect
  ↓
Identify the actual problem
  ↓
Fix
  ↓
Retest
  ↓
Improve
```

Financial correctness and data integrity take priority over visual
features.

## Privacy

Ledger is intended primarily as a private personal finance application.

A private source-code repository does not by itself make deployed
financial data private. Authentication, database security, Row Level
Security, secure configuration, and backups are separate requirements.

## Disclaimer

Ledger is a personal finance tracking project. It is not banking
software, accounting software, financial advice, or a replacement for
official bank records.

Always verify important balances against official financial institution
records.

## Current Milestone

Get the existing Ledger React application successfully running through
Vite and deployed to Vercel.

### Next Milestone

Add Supabase authentication and secure cross-device synchronization.
