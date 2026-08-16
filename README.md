# Ledger

```{=html}
<p align="center">
```
`<img src="public/icon-512.png" width="120" alt="Ledger app icon" />`{=html}
```{=html}
</p>
```
```{=html}
<h3 align="center">
```
Track • Manage • Grow
```{=html}
</h3>
```
```{=html}
<p align="center">
```
A private, mobile-first personal finance tracker for understanding where
your money is, where it goes, and what comes next.
```{=html}
</p>
```
```{=html}
<p align="center">
```
`<strong>`{=html}React`</strong>`{=html} ·
`<strong>`{=html}Vite`</strong>`{=html} ·
`<strong>`{=html}Supabase`</strong>`{=html} ·
`<strong>`{=html}Vercel`</strong>`{=html} ·
`<strong>`{=html}PWA`</strong>`{=html}
```{=html}
</p>
```

------------------------------------------------------------------------

## Final Vision

Ledger is designed to bring everyday personal finances into one clean
dashboard: cash and bank accounts, savings, credit-card debt, available
credit, monthly spending, transactions, budgets, recurring activity,
notes, exports, and backups.

The current dashboard logic already includes **Money Available**,
**Total Savings**, **Credit Card Debt**, **Available Credit**, and
**Spending This Month**. It also calculates a **Net Position** from
cash + savings − credit-card debt.

### Final dashboard concept

> This is a concept preview of the finished Ledger experience. Some
> screens and visual elements shown below are planned UI and may differ
> from the current build.

![Ledger final dashboard
concept](docs/ledger-dashboard-final-preview.png)

------------------------------------------------------------------------

## What Ledger Can Do

### Dashboard

Get the important numbers without digging through transactions:

-   Money Available
-   Total Savings
-   Credit Card Debt
-   Available Credit
-   Spending This Month
-   Net Position
-   Recent transactions

### Accounts

Track multiple financial accounts independently, including everyday
cash/bank accounts, savings accounts, and credit cards.

### Transactions

Ledger supports:

-   Expenses
-   Income / money added
-   Transfers
-   Add to savings
-   Withdraw from savings
-   Credit-card purchases
-   Credit-card payments
-   Manual adjustments

Transfers are handled separately from spending so moving your own money
does not falsely inflate expenses.

### Spending & Categories

Organize spending with built-in categories such as groceries,
restaurants, gas, transportation, housing, utilities, phone/internet,
shopping, childcare, health, education, entertainment, subscriptions,
travel, bills, gifts, and miscellaneous.

Custom categories can also be added.

### Budgets & Recurring Activity

Set monthly category budgets and keep track of recurring financial
activity such as rent, subscriptions, regular savings, income, phone
bills, and credit-card payments.

### Notes

Attach context to your finances with notes for balances, transactions,
dates, amounts, accounts, and other useful details.

### Reports, Export & Backup

Ledger includes:

-   Excel `.xlsx` export
-   CSV transaction export
-   JSON backup
-   JSON restore

------------------------------------------------------------------------

## Private Accounts & Cloud Sync

Ledger now uses **Supabase authentication and per-user cloud storage**.

Each signed-in user receives their own finance data. Account-isolation
testing has confirmed that two different Ledger accounts can maintain
different balances and data without seeing each other's information.

The storage layer also keeps a user-scoped local browser copy as a
fallback while Supabase provides the cloud copy.

``` text
Phone / PWA
     │
     ▼
   Ledger
     │
     ▼
Supabase Auth + Database
     ▲
     │
   Ledger
     ▲
     │
Laptop / Browser
```

### Security principle

Ledger should never be used to store banking passwords, PINs, CVVs, full
payment-card numbers, government identification numbers, authentication
codes, or security answers.

Use account nicknames and financial balances instead.

------------------------------------------------------------------------

## Installable PWA

Ledger is being packaged as a Progressive Web App so it can live on a
phone Home Screen and open more like a native application.

PWA assets include:

``` text
public/
├── icon-192.png
└── icon-512.png
```

The Ledger icon uses the project's deep-green and teal visual identity.

------------------------------------------------------------------------

## Technology

  Layer                 Technology
  --------------------- -----------------------------------
  Interface             React
  Build tool            Vite
  Language              JavaScript / JSX
  Styling               Tailwind CSS + application styles
  Icons                 Lucide React
  Authentication        Supabase Auth
  Cloud data            Supabase
  Spreadsheet export    SheetJS / XLSX
  Source control        GitHub
  Deployment            Vercel
  Mobile installation   Progressive Web App

------------------------------------------------------------------------

## Project Structure

``` text
ledger-finance-app/
├── public/
│   ├── icon-192.png
│   └── icon-512.png
├── docs/
│   └── ledger-dashboard-final-preview.png
├── src/
│   ├── App.jsx
│   ├── AuthScreen.jsx
│   ├── ledgerStorage.js
│   ├── supabase.js
│   ├── index.css
│   └── main.jsx
├── README.md
├── index.html
├── package.json
└── vite.config.js
```

`App.jsx` contains the main interface and financial logic.
`ledgerStorage.js` handles user-scoped local/cloud persistence.
`supabase.js` configures the Supabase client, while `AuthScreen.jsx`
provides authentication.

------------------------------------------------------------------------

## Run Locally

``` bash
npm install
npm run dev
```

Production build:

``` bash
npm run build
```

The production output is generated in `dist/`.

Expected Supabase client environment variables:

``` text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Never commit a Supabase `service_role` key or other privileged
credentials.

------------------------------------------------------------------------

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

Commits to the connected GitHub repository can trigger fresh Vercel
deployments.

------------------------------------------------------------------------

## Build Progress

### Core finance

-   [x] Dashboard
-   [x] Account management
-   [x] Transaction tracking
-   [x] Savings tracking
-   [x] Credit-card tracking
-   [x] Spending categories
-   [x] Custom categories
-   [x] Notes
-   [x] Budgets
-   [x] Recurring transactions
-   [x] Excel export
-   [x] CSV export
-   [x] JSON backup / restore
-   [x] Mobile-responsive interface

### Accounts & cloud

-   [x] Supabase project
-   [x] Supabase client
-   [x] Email/password authentication
-   [x] Per-user cloud data
-   [x] Cross-browser data synchronization
-   [x] Logout/login testing
-   [x] Account-isolation testing
-   [x] User-scoped local fallback

### Deployment & PWA

-   [x] GitHub repository
-   [x] Vite production project
-   [x] Vercel deployment
-   [x] Mobile deployment
-   [x] PWA configuration
-   [x] Ledger 192×192 icon
-   [x] Ledger 512×512 icon
-   [ ] Final installed-icon verification
-   [ ] Final PWA/offline testing

### Final quality pass

-   [ ] Full transaction-calculation test suite
-   [ ] Credit-card calculation regression tests
-   [ ] Transfer/savings regression tests
-   [ ] Edit/delete regression tests
-   [ ] Export and restore regression tests
-   [ ] Error-handling review
-   [ ] Final mobile UX polish
-   [ ] Final security review

------------------------------------------------------------------------

## Financial Logic Matters

Ledger treats financial correctness as more important than decorative
features.

A simple sanity test:

``` text
Starting:
Chequing      $2,000
Savings         $700
Card debt       $500
Card limit    $3,000

Spend $100 from chequing:
Chequing      $1,900
Spending        $100

Transfer $500 to savings:
Chequing      $1,400
Savings       $1,200
Spending        $100

Spend $200 on the card:
Card debt       $700
Available     $2,300
Spending        $300

Pay $300 toward the card:
Chequing      $1,100
Card debt       $400
Available     $2,600
Spending        $300
```

Moving money between your own accounts should not magically become
spending.

------------------------------------------------------------------------

## Development Rule

``` text
Build
  ↓
Test
  ↓
Inspect
  ↓
Find the actual problem
  ↓
Fix one thing
  ↓
Retest
  ↓
Improve
```

For a finance application, data integrity and account isolation come
first.

------------------------------------------------------------------------

## Road Ahead

The next stage is not adding random features. It is finishing the
product properly: verify the installed PWA icon, complete regression
testing, tighten error handling, polish the mobile experience, and
validate security before treating Ledger as dependable for everyday use.

Future enhancements can then focus on richer analytics, clearer trends,
improved budgeting insights, goals, and more useful reports.

------------------------------------------------------------------------

## Privacy & Disclaimer

Ledger is a personal finance tracking project, not a bank, accounting
platform, or source of financial advice.

A private repository alone does not make financial data secure.
Authentication, database permissions, Row Level Security, secure
configuration, backups, and careful credential handling all matter.

Always verify important balances against official financial-institution
records.

------------------------------------------------------------------------

```{=html}
<p align="center">
```
`<strong>`{=html}Ledger`</strong>`{=html}`<br/>`{=html} Track what you
have. Understand where it goes. Grow with intention.
```{=html}
</p>
```
