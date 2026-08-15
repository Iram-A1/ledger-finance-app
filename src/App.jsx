import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import AuthScreen from "./AuthScreen";
import { supabase } from "./supabase";
import {
  Wallet, PiggyBank, CreditCard, TrendingDown, TrendingUp, Plus, X, Search,
  Home, Receipt, PieChart as PieIcon, Landmark, StickyNote, FileBarChart, Settings as SettingsIcon,
  Pencil, Trash2, ArrowRightLeft, ArrowDownCircle, ArrowUpCircle, Download, Upload,
  ShoppingCart, Utensils, Fuel, Car, Building2, Zap, Phone, ShoppingBag, Baby, HeartPulse,
  GraduationCap, Film, Repeat, Plane, FileText, Gift, MoreHorizontal, Check, ChevronDown,
  AlertTriangle, Copy, Filter, ArrowLeft, Banknote, ShieldCheck, Info, Target, CalendarClock, Pause, Play
} from "lucide-react";
import * as XLSX from "xlsx";

/* ---------------------------------------------------------------------- */
/* Design tokens                                                           */
/* ---------------------------------------------------------------------- */
const T = {
  bg: "#F4F6F3",
  paper: "#FFFFFF",
  ink: "#122019",
  inkSoft: "#4B5A52",
  line: "#DCE3DD",
  teal: "#1B7A6B",
  tealSoft: "#E6F2EF",
  gold: "#B8860B",
  goldSoft: "#FAF1DD",
  brick: "#AD4A3C",
  brickSoft: "#F7E7E3",
  steel: "#3E5C76",
  steelSoft: "#E9EEF3",
  ok: "#1B7A6B",
  warn: "#B8860B",
  danger: "#AD4A3C",
};

const FONTS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap');
`;

const CATEGORY_ICONS = {
  groceries: ShoppingCart, restaurants: Utensils, gas: Fuel, transport: Car,
  housing: Building2, utilities: Zap, phone: Phone, shopping: ShoppingBag,
  childcare: Baby, health: HeartPulse, education: GraduationCap, entertainment: Film,
  subscriptions: Repeat, travel: Plane, bills: FileText, gifts: Gift, misc: MoreHorizontal,
};

const DEFAULT_CATEGORIES = [
  { id: "groceries", name: "Groceries", icon: "groceries" },
  { id: "restaurants", name: "Restaurants / Food", icon: "restaurants" },
  { id: "gas", name: "Gas", icon: "gas" },
  { id: "transport", name: "Car / Transportation", icon: "transport" },
  { id: "housing", name: "Rent / Housing", icon: "housing" },
  { id: "utilities", name: "Utilities", icon: "utilities" },
  { id: "phone", name: "Phone / Internet", icon: "phone" },
  { id: "shopping", name: "Shopping", icon: "shopping" },
  { id: "childcare", name: "Childcare / Kids", icon: "childcare" },
  { id: "health", name: "Health", icon: "health" },
  { id: "education", name: "Education", icon: "education" },
  { id: "entertainment", name: "Entertainment", icon: "entertainment" },
  { id: "subscriptions", name: "Subscriptions", icon: "subscriptions" },
  { id: "travel", name: "Travel", icon: "travel" },
  { id: "bills", name: "Bills", icon: "bills" },
  { id: "gifts", name: "Gifts", icon: "gifts" },
  { id: "misc", name: "Miscellaneous", icon: "misc" },
];

const TX_TYPES = {
  expense: { label: "Expense", spending: true, needsCategory: true, shape: "single" },
  income: { label: "Income / Add Money", spending: false, needsCategory: false, shape: "single" },
  transfer: { label: "Transfer", spending: false, needsCategory: false, shape: "pair" },
  savings_add: { label: "Add to Savings", spending: false, needsCategory: false, shape: "pair" },
  savings_withdraw: { label: "Withdraw from Savings", spending: false, needsCategory: false, shape: "pair" },
  cc_purchase: { label: "Credit Card Purchase", spending: true, needsCategory: true, shape: "single" },
  cc_payment: { label: "Credit Card Payment", spending: false, needsCategory: false, shape: "pair" },
  adjustment: { label: "Manual Adjustment", spending: false, needsCategory: false, shape: "signed" },
};

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const todayStr = () => new Date().toISOString().slice(0, 10);

function fmtMoney(n, currency = "CAD") {
  const v = Number.isFinite(n) ? n : 0;
  const symbol = currency === "CAD" || currency === "USD" ? "$" : currency + " ";
  const neg = v < 0;
  const s = symbol + Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return neg ? "-" + s : s;
}

/* ---------------------------------------------------------------------- */
/* Storage                                                                  */
/* ---------------------------------------------------------------------- */
const STORAGE_KEY = "finance-app:data";
const hasClaudeStorage = typeof window !== "undefined" && !!window.storage;

const emptyData = () => ({
  accounts: [],
  transactions: [],
  notes: [],
  categories: DEFAULT_CATEGORIES,
  settings: { currency: "CAD", recentAccounts: [], recentCategories: [] },
  onboardingDone: false,
  budgets: {}, // { [categoryId]: monthlyAmount }
  recurringRules: [], // { id, name, type, amount, fromAccountId, toAccountId, category, frequency, nextDate, active, description, note, merchant }
});

async function loadData() {
  try {
    if (hasClaudeStorage) {
      const res = await window.storage.get(STORAGE_KEY, false);
      if (res && res.value) return { ...emptyData(), ...JSON.parse(res.value) };
    } else {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...emptyData(), ...JSON.parse(raw) };
    }
  } catch (e) { /* key not found or storage unavailable */ }
  return emptyData();
}
async function saveData(data) {
  try {
    if (hasClaudeStorage) {
      await window.storage.set(STORAGE_KEY, JSON.stringify(data), false);
    } else {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  } catch (e) { console.error("save failed", e); }
}

/* ---------------------------------------------------------------------- */
/* Balance / spending calculations                                         */
/* ---------------------------------------------------------------------- */
function computeBalance(account, transactions) {
  let bal = Number(account.startingBalance) || 0;
  for (const t of transactions) {
    if (account.type === "credit") {
      if (t.type === "cc_purchase" && t.fromAccountId === account.id) bal += t.amount;
      if (t.type === "cc_payment" && t.toAccountId === account.id) bal -= t.amount;
      if (t.type === "adjustment" && t.fromAccountId === account.id) bal += t.amount;
    } else {
      if (t.type === "expense" && t.fromAccountId === account.id) bal -= t.amount;
      if (t.type === "income" && t.toAccountId === account.id) bal += t.amount;
      if (t.type === "transfer") {
        if (t.fromAccountId === account.id) bal -= t.amount;
        if (t.toAccountId === account.id) bal += t.amount;
      }
      if (t.type === "savings_add") {
        if (t.fromAccountId === account.id) bal -= t.amount;
        if (t.toAccountId === account.id) bal += t.amount;
      }
      if (t.type === "savings_withdraw") {
        if (t.fromAccountId === account.id) bal -= t.amount;
        if (t.toAccountId === account.id) bal += t.amount;
      }
      if (t.type === "cc_payment" && t.fromAccountId === account.id) bal -= t.amount;
      if (t.type === "adjustment" && t.fromAccountId === account.id) bal += t.amount;
    }
  }
  return bal;
}

function withinRange(dateStr, range) {
  const d = new Date(dateStr + "T00:00:00");
  const now = new Date();
  if (range === "today") {
    return d.toDateString() === now.toDateString();
  }
  if (range === "week") {
    const start = new Date(now); start.setDate(now.getDate() - now.getDay());
    start.setHours(0, 0, 0, 0);
    return d >= start;
  }
  if (range === "month") {
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }
  if (range === "year") {
    return d.getFullYear() === now.getFullYear();
  }
  return true;
}

function isSpendingTx(t) {
  return t.type === "expense" || t.type === "cc_purchase";
}

const FREQUENCIES = {
  weekly: { label: "Weekly" },
  biweekly: { label: "Every 2 weeks" },
  monthly: { label: "Monthly" },
  yearly: { label: "Yearly" },
};

function addPeriod(dateStr, freq) {
  const d = new Date(dateStr + "T00:00:00");
  if (freq === "weekly") d.setDate(d.getDate() + 7);
  else if (freq === "biweekly") d.setDate(d.getDate() + 14);
  else if (freq === "monthly") d.setMonth(d.getMonth() + 1);
  else if (freq === "yearly") d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

// Generates any transactions that came due for active recurring rules, up to today.
// Returns { transactions: newTx[], rules: updatedRules[] }. Pure function, capped per rule to avoid runaway loops.
function processRecurringRules(rules, existingTransactions) {
  const today = todayStr();
  const newTx = [];
  const updatedRules = rules.map(rule => {
    if (!rule.active) return rule;
    let nextDate = rule.nextDate;
    let guard = 0;
    while (nextDate <= today && guard < 36) {
      newTx.push({
        id: uid(), createdAt: Date.now() + guard,
        type: rule.type, amount: rule.amount, date: nextDate,
        fromAccountId: rule.fromAccountId, toAccountId: rule.toAccountId,
        category: rule.category, description: rule.description || rule.name,
        note: rule.note, merchant: rule.merchant, tags: rule.tags,
        recurringId: rule.id,
      });
      nextDate = addPeriod(nextDate, rule.frequency);
      guard++;
    }
    return nextDate === rule.nextDate ? rule : { ...rule, nextDate };
  });
  return { transactions: newTx, rules: updatedRules };
}

function budgetStatus(pct) {
  if (pct >= 100) return { color: T.brick, label: "Over budget" };
  if (pct >= 80) return { color: T.gold, label: "Getting close" };
  return { color: T.teal, label: "On track" };
}

/* ---------------------------------------------------------------------- */
/* Small UI atoms                                                          */
/* ---------------------------------------------------------------------- */
function IconBadge({ Icon, bg, fg, size = 20 }) {
  return (
    <div style={{ background: bg, color: fg, width: 40, height: 40, borderRadius: 12 }}
      className="flex items-center justify-center shrink-0">
      <Icon size={size} strokeWidth={2.2} />
    </div>
  );
}

function CategoryIcon({ catId, size = 16 }) {
  const Icon = CATEGORY_ICONS[catId] || MoreHorizontal;
  return <Icon size={size} />;
}

function Card({ children, style, className = "" }) {
  return (
    <div
      className={className}
      style={{
        background: T.paper,
        border: `1px solid ${T.line}`,
        borderRadius: 18,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Btn({ children, onClick, variant = "primary", style, size = "md", disabled, type = "button" }) {
  const base = {
    fontFamily: "Inter, sans-serif",
    fontWeight: 600,
    borderRadius: 12,
    padding: size === "sm" ? "7px 12px" : "10px 16px",
    fontSize: size === "sm" ? 13 : 14.5,
    display: "inline-flex", alignItems: "center", gap: 6,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    border: "1px solid transparent",
    transition: "transform .08s ease, opacity .15s ease",
  };
  const variants = {
    primary: { background: T.ink, color: "#fff" },
    accent: { background: T.teal, color: "#fff" },
    outline: { background: "transparent", color: T.ink, border: `1px solid ${T.line}` },
    ghost: { background: "transparent", color: T.inkSoft },
    danger: { background: T.brick, color: "#fff" },
  };
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      onMouseDown={(e) => { if (!disabled) e.currentTarget.style.transform = "scale(0.97)"; }}
      onMouseUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
      style={{ ...base, ...variants[variant], ...style }}
    >
      {children}
    </button>
  );
}

function Field({ label, children, hint }) {
  return (
    <label className="block" style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: T.inkSoft, marginBottom: 5, letterSpacing: ".01em" }}>{label}</div>
      {children}
      {hint && <div style={{ fontSize: 11.5, color: "#8B958E", marginTop: 4 }}>{hint}</div>}
    </label>
  );
}

const inputStyle = {
  width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${T.line}`,
  fontSize: 14.5, fontFamily: "Inter, sans-serif", background: "#FBFCFB", color: T.ink, outline: "none",
};

function TextInput(props) {
  return <input {...props} style={{ ...inputStyle, ...(props.style || {}) }} />;
}
function Select({ children, ...props }) {
  return <select {...props} style={{ ...inputStyle, ...(props.style || {}) }}>{children}</select>;
}
function TextArea(props) {
  return <textarea {...props} style={{ ...inputStyle, resize: "vertical", minHeight: 60, ...(props.style || {}) }} />;
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(18,32,25,0.45)", zIndex: 60, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: T.paper, width: "100%", maxWidth: wide ? 640 : 480, maxHeight: "92vh", overflowY: "auto",
          borderRadius: "20px 20px 0 0", padding: 22, animation: "slideUp .18s ease",
          boxShadow: "0 -8px 30px rgba(0,0,0,0.15)",
        }}
        className="modal-desktop"
      >
        <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: "Fraunces, serif", fontSize: 20, fontWeight: 600, color: T.ink }}>{title}</div>
          <button onClick={onClose} style={{ background: T.bg, borderRadius: 999, padding: 6, border: "none", cursor: "pointer" }}>
            <X size={18} color={T.inkSoft} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ConfirmDialog({ title, message, onConfirm, onCancel, danger }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(18,32,25,0.45)", zIndex: 70, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={onCancel}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: T.paper, borderRadius: 18, padding: 22, maxWidth: 380, width: "100%" }}>
        <div style={{ display: "flex", gap: 12, marginBottom: 10 }}>
          <IconBadge Icon={AlertTriangle} bg={T.brickSoft} fg={T.brick} />
          <div>
            <div style={{ fontFamily: "Fraunces, serif", fontWeight: 600, fontSize: 17, color: T.ink }}>{title}</div>
          </div>
        </div>
        <div style={{ fontSize: 14, color: T.inkSoft, marginBottom: 20, lineHeight: 1.5 }}>{message}</div>
        <div className="flex justify-end gap-2">
          <Btn variant="outline" onClick={onCancel}>Cancel</Btn>
          <Btn variant={danger ? "danger" : "primary"} onClick={onConfirm}>Confirm</Btn>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ Icon, title, body, action }) {
  return (
    <div style={{ textAlign: "center", padding: "48px 20px", color: T.inkSoft }}>
      <div style={{ display: "inline-flex", background: T.bg, borderRadius: 999, padding: 16, marginBottom: 14 }}>
        <Icon size={28} color={T.inkSoft} />
      </div>
      <div style={{ fontFamily: "Fraunces, serif", fontSize: 17, fontWeight: 600, color: T.ink, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13.5, maxWidth: 320, margin: "0 auto 16px" }}>{body}</div>
      {action}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* App                                                                      */
/* ---------------------------------------------------------------------- */
export default function App() {
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error("Could not read auth session:", error);
        setSession(null);
        return;
      }
      setSession(data.session);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  if (session === undefined) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#F4F6F3",
          fontFamily: "Inter, sans-serif",
          color: "#4B5A52"
        }}
      >
        Loading Ledger...
      </div>
    );
  }

  if (!session) {
    return <AuthScreen />;
  }

  return <LedgerApp />;
}

function LedgerApp() {
  const [loaded, setLoaded] = useState(false);
  const [data, setData] = useState(emptyData());
  const [tab, setTab] = useState("dashboard");
  const [showAddTx, setShowAddTx] = useState(false);
  const [editingTx, setEditingTx] = useState(null);
  const [duplicateSeed, setDuplicateSeed] = useState(null);
  const [confirmState, setConfirmState] = useState(null);
  const [globalSearch, setGlobalSearch] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [toast, setToast] = useState(null);
  const saveTimer = useRef(null);

  useEffect(() => {
    loadData().then((d) => {
      // Catch up any recurring transactions that came due while the app was closed.
      const { transactions: due, rules: updatedRules } = processRecurringRules(d.recurringRules || [], d.transactions);
      setData(due.length ? { ...d, transactions: [...due, ...d.transactions], recurringRules: updatedRules } : d);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveData(data), 350);
    return () => clearTimeout(saveTimer.current);
  }, [data, loaded]);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }, []);

  const activeAccounts = useMemo(() => data.accounts.filter(a => !a.archived), [data.accounts]);

  const accountsWithBalance = useMemo(() => {
    return activeAccounts.map(a => ({ ...a, balance: computeBalance(a, data.transactions) }));
  }, [activeAccounts, data.transactions]);

  const totals = useMemo(() => {
    const cash = accountsWithBalance.filter(a => a.type === "cash").reduce((s, a) => s + a.balance, 0);
    const savings = accountsWithBalance.filter(a => a.type === "savings").reduce((s, a) => s + a.balance, 0);
    const cc = accountsWithBalance.filter(a => a.type === "credit");
    const debt = cc.reduce((s, a) => s + a.balance, 0);
    const limit = cc.reduce((s, a) => s + (Number(a.creditLimit) || 0), 0);
    const available = limit - debt;
    const spendingMonth = data.transactions.filter(t => isSpendingTx(t) && withinRange(t.date, "month")).reduce((s, t) => s + t.amount, 0);
    return { cash, savings, debt, available, spendingMonth, netPosition: cash + savings - debt };
  }, [accountsWithBalance, data.transactions]);

  /* ---- mutations ---- */
  const addAccount = (acc) => {
    setData(d => ({ ...d, accounts: [...d.accounts, { id: uid(), archived: false, ...acc }], onboardingDone: true }));
  };
  const updateAccount = (id, patch) => {
    setData(d => ({ ...d, accounts: d.accounts.map(a => a.id === id ? { ...a, ...patch } : a) }));
  };
  const archiveAccount = (id) => {
    updateAccount(id, { archived: true });
    showToast("Account archived");
  };

  const addTransaction = (tx) => {
    setData(d => {
      const recentAccounts = Array.from(new Set([tx.fromAccountId || tx.toAccountId, ...(d.settings.recentAccounts || [])])).slice(0, 5);
      const recentCategories = tx.category ? Array.from(new Set([tx.category, ...(d.settings.recentCategories || [])])).slice(0, 6) : d.settings.recentCategories;
      return {
        ...d,
        transactions: [{ id: uid(), createdAt: Date.now(), ...tx }, ...d.transactions],
        settings: { ...d.settings, recentAccounts, recentCategories },
      };
    });
    showToast("Transaction added");
  };
  const updateTransaction = (id, patch) => {
    setData(d => ({ ...d, transactions: d.transactions.map(t => t.id === id ? { ...t, ...patch } : t) }));
    showToast("Transaction updated");
  };
  const deleteTransaction = (id) => {
    setData(d => ({ ...d, transactions: d.transactions.filter(t => t.id !== id) }));
    showToast("Transaction deleted");
  };

  const addNote = (note) => setData(d => ({ ...d, notes: [{ id: uid(), date: todayStr(), ...note }, ...d.notes] }));
  const updateNote = (id, patch) => setData(d => ({ ...d, notes: d.notes.map(n => n.id === id ? { ...n, ...patch } : n) }));
  const deleteNote = (id) => setData(d => ({ ...d, notes: d.notes.filter(n => n.id !== id) }));

  const addCategory = (cat) => setData(d => ({ ...d, categories: [...d.categories, { id: uid(), icon: "misc", ...cat }] }));
  const updateCategory = (id, patch) => setData(d => ({ ...d, categories: d.categories.map(c => c.id === id ? { ...c, ...patch } : c) }));

  const setCurrency = (currency) => setData(d => ({ ...d, settings: { ...d.settings, currency } }));

  const setBudget = (categoryId, amount) => {
    setData(d => {
      const budgets = { ...d.budgets };
      if (amount == null || amount === "" || Number(amount) <= 0) delete budgets[categoryId];
      else budgets[categoryId] = Number(amount);
      return { ...d, budgets };
    });
    showToast("Budget updated");
  };

  const addRecurringRule = (rule) => {
    setData(d => {
      const withNew = { ...d, recurringRules: [{ id: uid(), active: true, ...rule }, ...d.recurringRules] };
      const { transactions: due, rules: updatedRules } = processRecurringRules(withNew.recurringRules, withNew.transactions);
      return due.length ? { ...withNew, transactions: [...due, ...withNew.transactions], recurringRules: updatedRules } : withNew;
    });
    showToast("Recurring transaction scheduled");
  };
  const updateRecurringRule = (id, patch) => {
    setData(d => ({ ...d, recurringRules: d.recurringRules.map(r => r.id === id ? { ...r, ...patch } : r) }));
    showToast("Recurring transaction updated");
  };
  const deleteRecurringRule = (id) => {
    setData(d => ({ ...d, recurringRules: d.recurringRules.filter(r => r.id !== id) }));
    showToast("Recurring transaction removed");
  };

  const askConfirm = (opts) => setConfirmState(opts);

  const currency = data.settings.currency || "CAD";

  if (!loaded) {
    return (
      <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: T.bg, fontFamily: "Inter, sans-serif", color: T.inkSoft }}>
        Loading your dashboard…
      </div>
    );
  }

  const needsOnboarding = data.accounts.length === 0;

  return (
    <div style={{ fontFamily: "Inter, sans-serif", background: T.bg, minHeight: "100%", color: T.ink }}>
      <style>{FONTS}{`
        * { box-sizing: border-box; }
        ::selection { background: ${T.tealSoft}; }
        input:focus, select:focus, textarea:focus { border-color: ${T.teal} !important; box-shadow: 0 0 0 3px ${T.tealSoft}; }
        .num { font-family: 'JetBrains Mono', monospace; font-variant-numeric: tabular-nums; }
        @keyframes slideUp { from { transform: translateY(24px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @media (min-width: 768px) { .modal-desktop { border-radius: 20px !important; margin-bottom: 40px; } }
        .navlink { display:flex; align-items:center; gap:10px; padding:10px 14px; border-radius:12px; font-size:14px; font-weight:600; color:${T.inkSoft}; cursor:pointer; }
        .navlink.active { background:${T.ink}; color:#fff; }
        .scrollbar-thin::-webkit-scrollbar{height:6px;width:6px;}
        .scrollbar-thin::-webkit-scrollbar-thumb{background:${T.line};border-radius:8px;}
      `}</style>

      <div style={{ maxWidth: 1180, margin: "0 auto", display: "flex" }}>
        {/* Sidebar (desktop) */}
        <div className="hidden md:flex" style={{ width: 220, flexDirection: "column", padding: "24px 14px", position: "sticky", top: 0, height: "100vh" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 10px", marginBottom: 26 }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: T.teal, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Banknote size={16} color="#fff" />
            </div>
            <div style={{ fontFamily: "Fraunces, serif", fontWeight: 700, fontSize: 18 }}>Ledger</div>
          </div>
          <NavItems tab={tab} setTab={setTab} />
          <div style={{ marginTop: "auto", padding: "10px", fontSize: 11, color: "#93A199", display: "flex", gap: 6, alignItems: "flex-start" }}>
            <ShieldCheck size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>Private to your Claude account on this device &amp; synced devices.</span>
          </div>
        </div>

        {/* Main */}
        <div style={{ flex: 1, minWidth: 0, paddingBottom: 90 }}>
          <TopBar
            currency={currency}
            search={globalSearch}
            setSearch={setGlobalSearch}
            onFocus={() => setShowSearchResults(true)}
            onAdd={() => { setEditingTx(null); setDuplicateSeed(null); setShowAddTx(true); }}
          />

          {showSearchResults && globalSearch.trim() && (
            <GlobalSearchPanel
              query={globalSearch}
              data={data}
              currency={currency}
              onClose={() => { setShowSearchResults(false); setGlobalSearch(""); }}
              onOpenTx={(t) => { setEditingTx(t); setShowAddTx(true); setShowSearchResults(false); setGlobalSearch(""); }}
            />
          )}

          <div style={{ padding: "0 18px" }}>
            {needsOnboarding ? (
              <Onboarding onAddAccount={addAccount} currency={currency} />
            ) : (
              <>
                {tab === "dashboard" && (
                  <Dashboard
                    totals={totals} accounts={accountsWithBalance} transactions={data.transactions}
                    categories={data.categories} currency={currency}
                    onGoTab={setTab}
                  />
                )}
                {tab === "transactions" && (
                  <TransactionsTab
                    transactions={data.transactions} accounts={accountsWithBalance} categories={data.categories} currency={currency}
                    onEdit={(t) => { setEditingTx(t); setShowAddTx(true); }}
                    onDuplicate={(t) => { setDuplicateSeed(t); setEditingTx(null); setShowAddTx(true); }}
                    onDelete={(t) => askConfirm({
                      title: "Delete this transaction?",
                      message: "This will remove it from history and recalculate affected balances. This cannot be undone.",
                      danger: true,
                      onConfirm: () => { deleteTransaction(t.id); setConfirmState(null); },
                    })}
                  />
                )}
                {tab === "spending" && (
                  <SpendingTab
                    transactions={data.transactions} accounts={accountsWithBalance} categories={data.categories} currency={currency}
                    budgets={data.budgets} onSetBudget={setBudget}
                  />
                )}
                {tab === "recurring" && (
                  <RecurringTab
                    rules={data.recurringRules} accounts={accountsWithBalance} categories={data.categories} settings={data.settings} currency={currency}
                    onAdd={addRecurringRule} onUpdate={updateRecurringRule}
                    onToggle={(r) => updateRecurringRule(r.id, { active: !r.active })}
                    onDelete={(r) => askConfirm({
                      title: `Delete "${r.name}"?`,
                      message: "This stops future occurrences. Transactions it already created stay in your history.",
                      danger: true,
                      onConfirm: () => { deleteRecurringRule(r.id); setConfirmState(null); },
                    })}
                  />
                )}
                {tab === "accounts" && (
                  <AccountsTab
                    accounts={accountsWithBalance} currency={currency}
                    onAdd={addAccount} onUpdate={updateAccount}
                    onArchive={(a) => askConfirm({
                      title: `Archive ${a.name}?`,
                      message: "Archived accounts are hidden from totals but their transaction history is kept safe.",
                      onConfirm: () => { archiveAccount(a.id); setConfirmState(null); },
                    })}
                  />
                )}
                {tab === "notes" && (
                  <NotesTab notes={data.notes} accounts={accountsWithBalance} currency={currency}
                    onAdd={addNote} onUpdate={updateNote}
                    onDelete={(n) => askConfirm({
                      title: "Delete this note?", message: "This note will be permanently removed.", danger: true,
                      onConfirm: () => { deleteNote(n.id); setConfirmState(null); },
                    })}
                  />
                )}
                {tab === "reports" && (
                  <ReportsTab data={data} currency={currency} showToast={showToast} setData={setData} />
                )}
                {tab === "settings" && (
                  <SettingsTab
                    currency={currency} setCurrency={setCurrency}
                    categories={data.categories} onAddCategory={addCategory} onUpdateCategory={updateCategory}
                    accounts={accountsWithBalance}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Bottom nav (mobile) */}
      <BottomNav tab={tab} setTab={setTab} onAdd={() => { setEditingTx(null); setDuplicateSeed(null); setShowAddTx(true); }} hidden={needsOnboarding} />

      {showAddTx && (
        <TransactionForm
          accounts={accountsWithBalance}
          categories={data.categories}
          settings={data.settings}
          currency={currency}
          editingTx={editingTx}
          seed={duplicateSeed}
          onClose={() => { setShowAddTx(false); setEditingTx(null); setDuplicateSeed(null); }}
          onSave={(tx) => {
            if (editingTx) updateTransaction(editingTx.id, tx);
            else addTransaction(tx);
            setShowAddTx(false); setEditingTx(null); setDuplicateSeed(null);
          }}
        />
      )}

      {confirmState && (
        <ConfirmDialog {...confirmState} onCancel={() => setConfirmState(null)} />
      )}

      {toast && (
        <div style={{
          position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)", background: T.ink, color: "#fff",
          padding: "9px 18px", borderRadius: 999, fontSize: 13, fontWeight: 600, zIndex: 80, display: "flex", alignItems: "center", gap: 6,
        }}>
          <Check size={14} /> {toast}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Nav                                                                      */
/* ---------------------------------------------------------------------- */
const NAV = [
  { id: "dashboard", label: "Dashboard", icon: Home },
  { id: "transactions", label: "Transactions", icon: Receipt },
  { id: "spending", label: "Spending", icon: PieIcon },
  { id: "accounts", label: "Accounts", icon: Landmark },
  { id: "recurring", label: "Recurring", icon: CalendarClock },
  { id: "notes", label: "Notes", icon: StickyNote },
  { id: "reports", label: "Reports", icon: FileBarChart },
  { id: "settings", label: "Settings", icon: SettingsIcon },
];

function NavItems({ tab, setTab }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {NAV.map(n => (
        <div key={n.id} className={`navlink ${tab === n.id ? "active" : ""}`} onClick={() => setTab(n.id)}>
          <n.icon size={17} /> {n.label}
        </div>
      ))}
    </div>
  );
}

const CORE_MOBILE_TABS = ["dashboard", "transactions", "spending", "accounts"];

function BottomNav({ tab, setTab, onAdd, hidden }) {
  const [showMore, setShowMore] = useState(false);
  if (hidden) return null;
  const items = NAV.filter(n => CORE_MOBILE_TABS.includes(n.id));
  const moreItems = NAV.filter(n => !CORE_MOBILE_TABS.includes(n.id));
  const moreActive = moreItems.some(n => n.id === tab);
  return (
    <>
      <div className="md:hidden" style={{
        position: "fixed", bottom: 0, left: 0, right: 0, background: T.paper, borderTop: `1px solid ${T.line}`,
        display: "flex", alignItems: "center", justifyContent: "space-around", padding: "8px 4px calc(8px + env(safe-area-inset-bottom))", zIndex: 50,
      }}>
        {items.slice(0, 2).map(n => <BottomBtn key={n.id} n={n} tab={tab} setTab={setTab} />)}
        <button onClick={onAdd} style={{
          background: T.teal, width: 52, height: 52, borderRadius: 999, border: "none", display: "flex",
          alignItems: "center", justifyContent: "center", marginTop: -22, boxShadow: "0 6px 14px rgba(27,122,107,0.4)", cursor: "pointer",
        }}>
          <Plus size={26} color="#fff" />
        </button>
        {items.slice(2).map(n => <BottomBtn key={n.id} n={n} tab={tab} setTab={setTab} />)}
        <button onClick={() => setShowMore(true)} style={{ background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: 4, cursor: "pointer", color: moreActive ? T.teal : "#9AA6A0" }}>
          <MoreHorizontal size={20} strokeWidth={moreActive ? 2.4 : 2} />
          <span style={{ fontSize: 10, fontWeight: 600 }}>More</span>
        </button>
      </div>
      {showMore && (
        <div className="md:hidden" style={{ position: "fixed", inset: 0, background: "rgba(18,32,25,0.45)", zIndex: 60 }} onClick={() => setShowMore(false)}>
          <div onClick={e => e.stopPropagation()} style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: T.paper, borderRadius: "20px 20px 0 0", padding: "18px 14px calc(18px + env(safe-area-inset-bottom))" }}>
            <div style={{ width: 36, height: 4, background: T.line, borderRadius: 999, margin: "0 auto 16px" }} />
            {moreItems.map(n => (
              <div key={n.id} className={`navlink ${tab === n.id ? "active" : ""}`} style={{ marginBottom: 4 }}
                onClick={() => { setTab(n.id); setShowMore(false); }}>
                <n.icon size={17} /> {n.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
function BottomBtn({ n, tab, setTab }) {
  const active = tab === n.id;
  return (
    <button onClick={() => setTab(n.id)} style={{ background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: 4, cursor: "pointer", color: active ? T.teal : "#9AA6A0" }}>
      <n.icon size={20} strokeWidth={active ? 2.4 : 2} />
      <span style={{ fontSize: 10, fontWeight: 600 }}>{n.label}</span>
    </button>
  );
}

/* ---------------------------------------------------------------------- */
/* Top bar + search                                                        */
/* ---------------------------------------------------------------------- */
function TopBar({ search, setSearch, onFocus, onAdd, currency }) {
  return (
    <div style={{ padding: "20px 18px 10px", display: "flex", gap: 10, alignItems: "center" }}>
      <div style={{ position: "relative", flex: 1 }}>
        <Search size={16} color="#93A199" style={{ position: "absolute", left: 12, top: 12 }} />
        <input
          value={search} onChange={(e) => setSearch(e.target.value)} onFocus={onFocus}
          placeholder="Search transactions, notes, accounts…"
          style={{ ...inputStyle, paddingLeft: 34, background: T.paper }}
        />
      </div>
      <div className="hidden md:block">
        <Btn variant="accent" onClick={onAdd}><Plus size={16} /> Add transaction</Btn>
      </div>
    </div>
  );
}

function GlobalSearchPanel({ query, data, currency, onClose, onOpenTx }) {
  const q = query.toLowerCase();
  const accountsById = Object.fromEntries(data.accounts.map(a => [a.id, a]));
  const catsById = Object.fromEntries(data.categories.map(c => [c.id, c]));
  const matchTx = data.transactions.filter(t => {
    const acct = accountsById[t.fromAccountId] || accountsById[t.toAccountId];
    return [t.description, t.merchant, t.note, acct?.name, acct?.institution, catsById[t.category]?.name]
      .filter(Boolean).some(f => f.toLowerCase().includes(q));
  }).slice(0, 8);
  const matchNotes = data.notes.filter(n => [n.title, n.note, n.tag].filter(Boolean).some(f => f.toLowerCase().includes(q))).slice(0, 6);
  const matchAccounts = data.accounts.filter(a => [a.name, a.institution].filter(Boolean).some(f => f.toLowerCase().includes(q))).slice(0, 6);

  return (
    <div style={{ padding: "0 18px 14px" }}>
      <Card style={{ padding: 14 }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: T.inkSoft }}>RESULTS FOR "{query}"</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={16} color={T.inkSoft} /></button>
        </div>
        {matchAccounts.length === 0 && matchTx.length === 0 && matchNotes.length === 0 && (
          <div style={{ fontSize: 13.5, color: T.inkSoft, padding: "8px 0" }}>No matches yet. Try a different term.</div>
        )}
        {matchAccounts.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#9AA6A0", marginBottom: 4 }}>ACCOUNTS</div>
            {matchAccounts.map(a => <div key={a.id} style={{ fontSize: 13.5, padding: "5px 0" }}>{a.name} <span style={{ color: T.inkSoft }}>· {fmtMoney(computeBalance(a, data.transactions), currency)}</span></div>)}
          </div>
        )}
        {matchTx.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#9AA6A0", marginBottom: 4 }}>TRANSACTIONS</div>
            {matchTx.map(t => (
              <div key={t.id} onClick={() => onOpenTx(t)} style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, padding: "6px 0", cursor: "pointer", borderTop: `1px solid ${T.line}` }}>
                <span>{t.description || TX_TYPES[t.type]?.label} <span style={{ color: T.inkSoft }}>· {t.date}</span></span>
                <span className="num">{fmtMoney(t.amount, currency)}</span>
              </div>
            ))}
          </div>
        )}
        {matchNotes.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#9AA6A0", marginBottom: 4 }}>NOTES</div>
            {matchNotes.map(n => <div key={n.id} style={{ fontSize: 13.5, padding: "5px 0", borderTop: `1px solid ${T.line}` }}>{n.title}</div>)}
          </div>
        )}
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Onboarding                                                              */
/* ---------------------------------------------------------------------- */
function Onboarding({ onAddAccount }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ type: "cash", name: "", institution: "", startingBalance: "", creditLimit: "" });

  const submit = () => {
    if (!form.name.trim()) return;
    onAddAccount({
      name: form.name.trim(), type: form.type, institution: form.institution.trim(),
      startingBalance: Number(form.startingBalance) || 0,
      creditLimit: form.type === "credit" ? Number(form.creditLimit) || 0 : undefined,
      note: "",
    });
    setForm({ type: "cash", name: "", institution: "", startingBalance: "", creditLimit: "" });
  };

  return (
    <div style={{ maxWidth: 480, margin: "40px auto" }}>
      <div style={{ textAlign: "center", marginBottom: 22 }}>
        <div style={{ fontFamily: "Fraunces, serif", fontSize: 26, fontWeight: 600 }}>Welcome to your ledger</div>
        <div style={{ color: T.inkSoft, fontSize: 14, marginTop: 6 }}>Let's set up your first account. It takes about 20 seconds.</div>
      </div>
      <Card style={{ padding: 20 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {[{v:"cash",l:"Cash / Bank",i:Wallet},{v:"savings",l:"Savings",i:PiggyBank},{v:"credit",l:"Credit Card",i:CreditCard}].map(o => (
            <button key={o.v} onClick={() => setForm(f => ({ ...f, type: o.v }))}
              style={{
                flex: 1, padding: "12px 6px", borderRadius: 12, cursor: "pointer", textAlign: "center",
                border: `1.5px solid ${form.type === o.v ? T.teal : T.line}`, background: form.type === o.v ? T.tealSoft : "#fff",
              }}>
              <o.i size={18} style={{ margin: "0 auto 4px" }} color={form.type === o.v ? T.teal : T.inkSoft} />
              <div style={{ fontSize: 12, fontWeight: 600 }}>{o.l}</div>
            </button>
          ))}
        </div>
        <Field label="Account name"><TextInput value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. CIBC Chequing" /></Field>
        <Field label="Bank / institution (optional)"><TextInput value={form.institution} onChange={e => setForm(f => ({ ...f, institution: e.target.value }))} placeholder="e.g. CIBC" /></Field>
        <Field label={form.type === "credit" ? "Current amount owed" : "Current balance"}>
          <TextInput type="number" value={form.startingBalance} onChange={e => setForm(f => ({ ...f, startingBalance: e.target.value }))} placeholder="0.00" />
        </Field>
        {form.type === "credit" && (
          <Field label="Credit limit"><TextInput type="number" value={form.creditLimit} onChange={e => setForm(f => ({ ...f, creditLimit: e.target.value }))} placeholder="0.00" /></Field>
        )}
        <Btn variant="accent" style={{ width: "100%", justifyContent: "center", marginTop: 4 }} onClick={submit}>Create account &amp; continue</Btn>
      </Card>
      <div style={{ display: "flex", justifyContent: "center", gap: 22, marginTop: 20, color: T.inkSoft, fontSize: 12.5 }}>
        <span>1. Create account</span><span>2. Set balance</span><span>3. Add more accounts</span><span>4. Track transactions</span>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Dashboard                                                                */
/* ---------------------------------------------------------------------- */
function Dashboard({ totals, accounts, transactions, categories, currency, onGoTab }) {
  const recent = transactions.slice(0, 6);
  const accountsById = Object.fromEntries(accounts.map(a => [a.id, a]));
  const catsById = Object.fromEntries(categories.map(c => [c.id, c]));

  const cards = [
    { key: "cash", label: "Money Available", value: totals.cash, Icon: Wallet, fg: T.steel, bg: T.steelSoft, tab: "accounts" },
    { key: "savings", label: "Total Savings", value: totals.savings, Icon: PiggyBank, fg: T.teal, bg: T.tealSoft, tab: "accounts" },
    { key: "debt", label: "Credit Card Debt", value: totals.debt, Icon: CreditCard, fg: T.brick, bg: T.brickSoft, tab: "accounts", isDebt: true },
    { key: "available", label: "Available Credit", value: totals.available, Icon: ShieldCheck, fg: T.gold, bg: T.goldSoft, tab: "accounts" },
    { key: "spending", label: "Spending This Month", value: totals.spendingMonth, Icon: TrendingDown, fg: T.brick, bg: T.brickSoft, tab: "spending" },
  ];

  return (
    <div style={{ paddingTop: 4 }}>
      <div className="grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, marginBottom: 18 }}>
        {cards.map(c => (
          <Card key={c.key} className="cursor-pointer" style={{ padding: 16 }}>
            <div onClick={() => onGoTab(c.tab)} style={{ cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <IconBadge Icon={c.Icon} bg={c.bg} fg={c.fg} />
              </div>
              <div style={{ fontSize: 12.5, color: T.inkSoft, fontWeight: 600, marginTop: 12 }}>{c.label}</div>
              <div className="num" style={{ fontSize: 24, fontWeight: 700, color: c.isDebt && c.value > 0 ? T.brick : T.ink, marginTop: 2 }}>
                {fmtMoney(c.value, currency)}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card style={{ padding: 18, marginBottom: 18, background: T.ink }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ color: "#B9C4BE", fontSize: 12.5, fontWeight: 600 }}>NET POSITION</div>
            <div style={{ color: "#fff", fontSize: 11.5, marginTop: 2 }}>Cash + Savings − Credit Card Debt (excludes available credit)</div>
          </div>
          <div className="num" style={{ color: "#fff", fontSize: 30, fontWeight: 700 }}>{fmtMoney(totals.netPosition, currency)}</div>
        </div>
      </Card>

      <div style={{ fontFamily: "Fraunces, serif", fontSize: 17, fontWeight: 600, marginBottom: 10 }}>Recent activity</div>
      {recent.length === 0 ? (
        <Card style={{ padding: 24, textAlign: "center", color: T.inkSoft, fontSize: 13.5 }}>No transactions yet — tap + to add your first one.</Card>
      ) : (
        <Card style={{ padding: 6 }}>
          {recent.map((t, i) => (
            <TxRow key={t.id} t={t} accountsById={accountsById} catsById={catsById} currency={currency} last={i === recent.length - 1} />
          ))}
        </Card>
      )}
    </div>
  );
}

function TxRow({ t, accountsById, catsById, currency, last, onClick }) {
  const info = TX_TYPES[t.type] || {};
  const spending = isSpendingTx(t);
  const acct = accountsById[t.fromAccountId] || accountsById[t.toAccountId];
  const cat = catsById[t.category];
  const Icon = info.shape === "pair" ? ArrowRightLeft : cat ? (CATEGORY_ICONS[cat.icon] || MoreHorizontal) : (t.type === "income" ? ArrowDownCircle : t.type === "adjustment" ? Pencil : ArrowUpCircle);
  const amtColor = spending ? T.brick : (t.type === "income" || (t.type==="adjustment" && t.amount>0)) ? T.teal : T.ink;
  const sign = spending ? "-" : (t.type === "income" ? "+" : "");
  return (
    <div onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 10px", borderBottom: last ? "none" : `1px solid ${T.line}`, cursor: onClick ? "pointer" : "default" }}>
      <IconBadge Icon={Icon} bg={T.bg} fg={T.inkSoft} size={16} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "flex", alignItems: "center", gap: 6 }}>
          {t.description || t.merchant || cat?.name || info.label}
          {t.recurringId && <Repeat size={11} color={T.inkSoft} title="Recurring" />}
        </div>
        <div style={{ fontSize: 12, color: T.inkSoft }}>{t.date} · {acct?.name || "—"}{cat ? " · " + cat.name : ""}</div>
      </div>
      <div className="num" style={{ fontWeight: 700, color: amtColor, fontSize: 14.5 }}>{sign}{fmtMoney(Math.abs(t.amount), currency)}</div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Transactions tab                                                        */
/* ---------------------------------------------------------------------- */
function TransactionsTab({ transactions, accounts, categories, currency, onEdit, onDuplicate, onDelete }) {
  const [filters, setFilters] = useState({ account: "", category: "", type: "", search: "", from: "", to: "" });
  const [showFilters, setShowFilters] = useState(false);
  const [sortDesc, setSortDesc] = useState(true);
  const accountsById = Object.fromEntries(accounts.map(a => [a.id, a]));
  const catsById = Object.fromEntries(categories.map(c => [c.id, c]));

  const filtered = useMemo(() => {
    let list = transactions.filter(t => {
      if (filters.account && t.fromAccountId !== filters.account && t.toAccountId !== filters.account) return false;
      if (filters.category && t.category !== filters.category) return false;
      if (filters.type && t.type !== filters.type) return false;
      if (filters.from && t.date < filters.from) return false;
      if (filters.to && t.date > filters.to) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const acct = accountsById[t.fromAccountId] || accountsById[t.toAccountId];
        if (![t.description, t.merchant, t.note, acct?.name].filter(Boolean).some(f => f.toLowerCase().includes(q))) return false;
      }
      return true;
    });
    list.sort((a, b) => sortDesc ? (b.date + b.createdAt).localeCompare(a.date + a.createdAt) : (a.date + a.createdAt).localeCompare(b.date + b.createdAt));
    return list;
  }, [transactions, filters, sortDesc, accountsById]);

  return (
    <div style={{ paddingTop: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 8, flexWrap: "wrap" }}>
        <div style={{ fontFamily: "Fraunces, serif", fontSize: 20, fontWeight: 600 }}>Transaction history</div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="outline" size="sm" onClick={() => setShowFilters(s => !s)}><Filter size={14} /> Filters</Btn>
          <Btn variant="outline" size="sm" onClick={() => setSortDesc(s => !s)}>{sortDesc ? "Newest first" : "Oldest first"}</Btn>
        </div>
      </div>

      {showFilters && (
        <Card style={{ padding: 14, marginBottom: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px,1fr))", gap: 10 }}>
            <TextInput placeholder="Search…" value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} />
            <Select value={filters.account} onChange={e => setFilters(f => ({ ...f, account: e.target.value }))}>
              <option value="">All accounts</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
            <Select value={filters.category} onChange={e => setFilters(f => ({ ...f, category: e.target.value }))}>
              <option value="">All categories</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <Select value={filters.type} onChange={e => setFilters(f => ({ ...f, type: e.target.value }))}>
              <option value="">All types</option>
              {Object.entries(TX_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </Select>
            <TextInput type="date" value={filters.from} onChange={e => setFilters(f => ({ ...f, from: e.target.value }))} />
            <TextInput type="date" value={filters.to} onChange={e => setFilters(f => ({ ...f, to: e.target.value }))} />
          </div>
          <div style={{ marginTop: 8 }}>
            <Btn variant="ghost" size="sm" onClick={() => setFilters({ account: "", category: "", type: "", search: "", from: "", to: "" })}>Clear filters</Btn>
          </div>
        </Card>
      )}

      {filtered.length === 0 ? (
        <EmptyState Icon={Receipt} title="No transactions found" body="Try adjusting your filters, or add a new transaction." />
      ) : (
        <Card style={{ padding: 6 }}>
          {filtered.map((t, i) => (
            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 4, borderBottom: i === filtered.length - 1 ? "none" : `1px solid ${T.line}` }}>
              <div style={{ flex: 1 }}><TxRow t={t} accountsById={accountsById} catsById={catsById} currency={currency} last onClick={() => onEdit(t)} /></div>
              <div style={{ display: "flex", gap: 2, paddingRight: 8 }}>
                <IconButton Icon={Copy} onClick={() => onDuplicate(t)} title="Duplicate" />
                <IconButton Icon={Trash2} onClick={() => onDelete(t)} title="Delete" color={T.brick} />
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

function IconButton({ Icon, onClick, title, color }) {
  return (
    <button title={title} onClick={onClick} style={{ background: "none", border: "none", cursor: "pointer", padding: 8, borderRadius: 8, color: color || T.inkSoft }}>
      <Icon size={15} />
    </button>
  );
}

/* ---------------------------------------------------------------------- */
/* Transaction form                                                        */
/* ---------------------------------------------------------------------- */
function TransactionForm({ accounts, categories, settings, currency, editingTx, seed, onClose, onSave }) {
  const base = editingTx || seed;
  const [type, setType] = useState(base?.type || "expense");
  const [amount, setAmount] = useState(base ? String(Math.abs(base.amount)) : "");
  const [date, setDate] = useState(editingTx ? base.date : todayStr());
  const [fromAccountId, setFromAccountId] = useState(base?.fromAccountId || (settings.recentAccounts?.[0] || accounts[0]?.id) || "");
  const [toAccountId, setToAccountId] = useState(base?.toAccountId || "");
  const [category, setCategory] = useState(base?.category || settings.recentCategories?.[0] || "");
  const [description, setDescription] = useState(base?.description || "");
  const [note, setNote] = useState(base?.note || "");
  const [merchant, setMerchant] = useState(base?.merchant || "");
  const [tags, setTags] = useState(base?.tags || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const info = TX_TYPES[type];
  const shape = info.shape;

  const cashSavingsAccounts = accounts.filter(a => a.type !== "credit");
  const creditAccounts = accounts.filter(a => a.type === "credit");
  const savingsAccounts = accounts.filter(a => a.type === "savings");
  const spendAccounts = accounts.filter(a => a.type === "cash" || a.type === "credit");

  // Sensible default source lists per type
  let fromOptions = accounts, toOptions = accounts;
  if (type === "expense") fromOptions = accounts.filter(a => a.type !== "credit");
  if (type === "cc_purchase") fromOptions = creditAccounts;
  if (type === "income") toOptions = accounts.filter(a => a.type !== "credit");
  if (type === "savings_add") { fromOptions = accounts.filter(a => a.type !== "credit"); toOptions = savingsAccounts; }
  if (type === "savings_withdraw") { fromOptions = savingsAccounts; toOptions = accounts.filter(a => a.type !== "credit"); }
  if (type === "cc_payment") { fromOptions = accounts.filter(a => a.type !== "credit"); toOptions = creditAccounts; }
  if (type === "adjustment") fromOptions = accounts;

  useEffect(() => {
    // reset account selections sensibly when type changes (only for new entries)
    if (editingTx) return;
    if (fromOptions.length && !fromOptions.find(a => a.id === fromAccountId)) setFromAccountId(fromOptions[0].id);
    if ((shape === "pair") && toOptions.length && !toOptions.find(a => a.id === toAccountId)) setToAccountId(toOptions[0].id);
  }, [type]);

  const submit = () => {
    setError("");
    const amt = Number(amount);
    if (!amount || isNaN(amt) || amt <= 0) { setError("Enter a valid amount greater than zero."); return; }
    if (!date) { setError("Please choose a date."); return; }
    if ((shape === "single" || shape === "signed") && !fromAccountId) { setError("Please choose an account."); return; }
    if (type === "income" && !toAccountId) { setError("Please choose an account."); return; }
    if (shape === "pair" && (!fromAccountId || !toAccountId)) { setError("Please choose both accounts."); return; }
    if (shape === "pair" && fromAccountId === toAccountId) { setError("Choose two different accounts for a transfer."); return; }
    if (info.needsCategory && !category) { setError("Please choose a category."); return; }
    if (submitting) return;
    setSubmitting(true);

    const payload = {
      type, amount: type === "adjustment" ? amt : amt, date,
      fromAccountId: type === "income" ? undefined : fromAccountId,
      toAccountId: type === "income" ? fromAccountId : (shape === "pair" ? toAccountId : undefined),
      category: info.needsCategory ? category : undefined,
      description: description.trim(), note: note.trim(), merchant: merchant.trim(), tags: tags.trim(),
    };
    // fix income mapping: income should set toAccountId only
    if (type === "income") { payload.fromAccountId = undefined; payload.toAccountId = fromAccountId; }
    onSave(payload);
  };

  return (
    <Modal title={editingTx ? "Edit transaction" : "Add transaction"} onClose={onClose}>
      <Field label="Type">
        <Select value={type} onChange={e => setType(e.target.value)}>
          {Object.entries(TX_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </Select>
      </Field>

      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <Field label="Amount">
            <TextInput type="number" inputMode="decimal" autoFocus value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label="Date"><TextInput type="date" value={date} onChange={e => setDate(e.target.value)} /></Field>
        </div>
      </div>

      {type === "income" && (
        <Field label="Account"><Select value={fromAccountId} onChange={e => setFromAccountId(e.target.value)}>
          {fromOptions.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </Select></Field>
      )}
      {(shape === "single" && type !== "income") && (
        <Field label="Account"><Select value={fromAccountId} onChange={e => setFromAccountId(e.target.value)}>
          {fromOptions.length === 0 ? <option value="">Add a credit card account first</option> : fromOptions.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </Select></Field>
      )}
      {shape === "signed" && (
        <Field label="Account" hint="Positive amount increases the balance, use for corrections.">
          <Select value={fromAccountId} onChange={e => setFromAccountId(e.target.value)}>
            {fromOptions.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
        </Field>
      )}
      {shape === "pair" && (
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ flex: 1 }}>
            <Field label="From"><Select value={fromAccountId} onChange={e => setFromAccountId(e.target.value)}>
              {fromOptions.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select></Field>
          </div>
          <ArrowRightLeft size={16} color={T.inkSoft} style={{ marginTop: 14 }} />
          <div style={{ flex: 1 }}>
            <Field label="To"><Select value={toAccountId} onChange={e => setToAccountId(e.target.value)}>
              {toOptions.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select></Field>
          </div>
        </div>
      )}

      {info.needsCategory && (
        <Field label="Category">
          <Select value={category} onChange={e => setCategory(e.target.value)}>
            <option value="">Choose category…</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
      )}

      <Field label="Description (optional)"><TextInput value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Weekly groceries" /></Field>
      <Field label="Merchant / payee (optional)"><TextInput value={merchant} onChange={e => setMerchant(e.target.value)} placeholder="e.g. Walmart" /></Field>
      <Field label="Note (optional)"><TextArea value={note} onChange={e => setNote(e.target.value)} placeholder="Where did this money come from or go?" /></Field>
      <Field label="Tags (optional, comma separated)"><TextInput value={tags} onChange={e => setTags(e.target.value)} placeholder="e.g. work, reimbursable" /></Field>

      {error && <div style={{ background: T.brickSoft, color: T.brick, padding: "8px 12px", borderRadius: 10, fontSize: 13, marginBottom: 12 }}>{error}</div>}

      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        <Btn variant="outline" style={{ flex: 1, justifyContent: "center" }} onClick={onClose}>Cancel</Btn>
        <Btn variant="accent" style={{ flex: 1, justifyContent: "center" }} disabled={submitting} onClick={submit}>{editingTx ? "Save changes" : "Add transaction"}</Btn>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------------------- */
/* Spending tab                                                            */
/* ---------------------------------------------------------------------- */
function SpendingTab({ transactions, accounts, categories, currency, budgets, onSetBudget }) {
  const spendTx = transactions.filter(isSpendingTx);
  const catsById = Object.fromEntries(categories.map(c => [c.id, c]));
  const [budgetModalCat, setBudgetModalCat] = useState(null);
  const sums = { today: 0, week: 0, month: 0, year: 0 };
  for (const t of spendTx) {
    for (const r of Object.keys(sums)) if (withinRange(t.date, r)) sums[r] += t.amount;
  }
  const monthSpendByCategory = useMemo(() => {
    const map = {};
    for (const t of spendTx) {
      if (!withinRange(t.date, "month")) continue;
      map[t.category] = (map[t.category] || 0) + t.amount;
    }
    return map;
  }, [spendTx]);

  const byCategory = Object.entries(monthSpendByCategory).sort((a, b) => b[1] - a[1]);
  const maxCat = Math.max(1, ...byCategory.map(c => c[1]));
  const palette = [T.teal, T.gold, T.steel, T.brick, "#6D6875", "#8AA29E", "#C08552"];

  const budgetEntries = Object.entries(budgets || {});
  const totalBudgeted = budgetEntries.reduce((s, [, v]) => s + v, 0);
  const totalBudgetSpent = budgetEntries.reduce((s, [catId]) => s + (monthSpendByCategory[catId] || 0), 0);

  return (
    <div style={{ paddingTop: 4 }}>
      <div style={{ fontFamily: "Fraunces, serif", fontSize: 20, fontWeight: 600, marginBottom: 12 }}>Spending</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px,1fr))", gap: 10, marginBottom: 20 }}>
        {[["Today","today"],["This week","week"],["This month","month"],["This year","year"]].map(([label,key]) => (
          <Card key={key} style={{ padding: 14 }}>
            <div style={{ fontSize: 12, color: T.inkSoft, fontWeight: 600 }}>{label}</div>
            <div className="num" style={{ fontSize: 19, fontWeight: 700, marginTop: 4 }}>{fmtMoney(sums[key], currency)}</div>
          </Card>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontFamily: "Fraunces, serif", fontSize: 16, fontWeight: 600, display: "flex", alignItems: "center", gap: 7 }}>
          <Target size={16} color={T.teal} /> Monthly budgets
        </div>
        {budgetEntries.length > 0 && (
          <span className="num" style={{ fontSize: 12.5, color: T.inkSoft, fontWeight: 600 }}>
            {fmtMoney(totalBudgetSpent, currency)} of {fmtMoney(totalBudgeted, currency)}
          </span>
        )}
      </div>
      <Card style={{ padding: 16, marginBottom: 22 }}>
        {categories.map((cat, i) => {
          const budget = budgets?.[cat.id];
          const spent = monthSpendByCategory[cat.id] || 0;
          if (budget == null && spent === 0) return null; // hide categories with no budget and no spend
          const pct = budget ? Math.min(999, Math.round((spent / budget) * 100)) : null;
          const status = pct != null ? budgetStatus(pct) : null;
          return (
            <div key={cat.id} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: `1px solid ${T.line}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600, fontSize: 13.5 }}>
                  <CategoryIcon catId={cat.icon} size={14} /> {cat.name}
                </span>
                <button onClick={() => setBudgetModalCat(cat)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                  {budget != null ? (
                    <span className="num" style={{ fontSize: 13, fontWeight: 700, color: status.color }}>
                      {fmtMoney(spent, currency)} of {fmtMoney(budget, currency)}
                    </span>
                  ) : (
                    <span style={{ fontSize: 12.5, color: T.teal, fontWeight: 700 }}>Set budget</span>
                  )}
                  <Pencil size={12} color={T.inkSoft} />
                </button>
              </div>
              {budget != null && (
                <>
                  <div style={{ height: 8, background: T.bg, borderRadius: 999, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: Math.min(100, pct) + "%", background: status.color, borderRadius: 999 }} />
                  </div>
                  <div style={{ fontSize: 11.5, color: status.color, marginTop: 4, fontWeight: 600 }}>
                    {pct}% used {pct >= 100 ? `· ${fmtMoney(spent - budget, currency)} over` : `· ${status.label}`}
                  </div>
                </>
              )}
            </div>
          );
        })}
        <Btn variant="ghost" size="sm" onClick={() => setBudgetModalCat({ id: "__pick__" })}>
          <Plus size={14} /> Set a budget for another category
        </Btn>
      </Card>

      <div style={{ fontFamily: "Fraunces, serif", fontSize: 16, fontWeight: 600, marginBottom: 10 }}>By category — this month</div>
      {byCategory.length === 0 ? (
        <EmptyState Icon={PieIcon} title="Nothing spent this month yet" body="Once you log expenses, you'll see a breakdown by category here." />
      ) : (
        <Card style={{ padding: 16 }}>
          {byCategory.map(([catId, amt], i) => {
            const cat = catsById[catId];
            const pct = Math.round((amt / maxCat) * 100);
            return (
              <div key={catId} style={{ marginBottom: i === byCategory.length - 1 ? 0 : 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, marginBottom: 5 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
                    <CategoryIcon catId={cat?.icon} size={14} /> {cat?.name || "Uncategorized"}
                  </span>
                  <span className="num" style={{ fontWeight: 700 }}>{fmtMoney(amt, currency)}</span>
                </div>
                <div style={{ height: 8, background: T.bg, borderRadius: 999, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: pct + "%", background: palette[i % palette.length], borderRadius: 999 }} />
                </div>
              </div>
            );
          })}
        </Card>
      )}

      {budgetModalCat && (
        <BudgetForm
          category={budgetModalCat.id === "__pick__" ? null : budgetModalCat}
          categories={categories}
          currentValue={budgetModalCat.id === "__pick__" ? "" : budgets?.[budgetModalCat.id]}
          onClose={() => setBudgetModalCat(null)}
          onSave={(catId, amount) => { onSetBudget(catId, amount); setBudgetModalCat(null); }}
        />
      )}
    </div>
  );
}

function BudgetForm({ category, categories, currentValue, onClose, onSave }) {
  const [catId, setCatId] = useState(category?.id || categories[0]?.id || "");
  const [amount, setAmount] = useState(currentValue != null ? String(currentValue) : "");
  return (
    <Modal title={category ? `Budget for ${category.name}` : "Set a monthly budget"} onClose={onClose}>
      {!category && (
        <Field label="Category">
          <Select value={catId} onChange={e => setCatId(e.target.value)}>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
      )}
      <Field label="Monthly budget" hint="Leave blank or 0 to remove the budget for this category.">
        <TextInput type="number" autoFocus value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
      </Field>
      <div style={{ display: "flex", gap: 8 }}>
        <Btn variant="outline" style={{ flex: 1, justifyContent: "center" }} onClick={onClose}>Cancel</Btn>
        <Btn variant="accent" style={{ flex: 1, justifyContent: "center" }} onClick={() => onSave(catId, amount)}>Save budget</Btn>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------------------- */
/* Accounts tab                                                            */
/* ---------------------------------------------------------------------- */
const ACCOUNT_TYPE_META = {
  cash: { label: "Cash / Bank", Icon: Wallet, fg: T.steel, bg: T.steelSoft },
  savings: { label: "Savings", Icon: PiggyBank, fg: T.teal, bg: T.tealSoft },
  credit: { label: "Credit Cards", Icon: CreditCard, fg: T.brick, bg: T.brickSoft },
};

function AccountsTab({ accounts, currency, onAdd, onUpdate, onArchive }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const groups = { cash: [], savings: [], credit: [] };
  accounts.forEach(a => groups[a.type]?.push(a));

  return (
    <div style={{ paddingTop: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontFamily: "Fraunces, serif", fontSize: 20, fontWeight: 600 }}>Accounts</div>
        <Btn variant="accent" size="sm" onClick={() => { setEditing(null); setShowForm(true); }}><Plus size={14} /> New account</Btn>
      </div>

      {Object.entries(groups).map(([type, list]) => {
        const meta = ACCOUNT_TYPE_META[type];
        const total = list.reduce((s, a) => s + a.balance, 0);
        return (
          <div key={type} style={{ marginBottom: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <meta.Icon size={16} color={meta.fg} />
                <span style={{ fontWeight: 700, fontSize: 14 }}>{meta.label}</span>
              </div>
              <span className="num" style={{ fontWeight: 700, fontSize: 15, color: type === "credit" && total > 0 ? T.brick : T.ink }}>
                TOTAL: {fmtMoney(total, currency)}
              </span>
            </div>
            {list.length === 0 ? (
              <Card style={{ padding: 18, textAlign: "center", color: T.inkSoft, fontSize: 13 }}>No {meta.label.toLowerCase()} accounts yet.</Card>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px,1fr))", gap: 10 }}>
                {list.map(a => (
                  <Card key={a.id} style={{ padding: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14.5 }}>{a.name}</div>
                        {a.institution && <div style={{ fontSize: 12, color: T.inkSoft }}>{a.institution}</div>}
                      </div>
                      <div style={{ display: "flex", gap: 2 }}>
                        <IconButton Icon={Pencil} onClick={() => { setEditing(a); setShowForm(true); }} title="Edit" />
                        <IconButton Icon={Trash2} onClick={() => onArchive(a)} title="Archive" color={T.brick} />
                      </div>
                    </div>
                    <div className="num" style={{ fontSize: 21, fontWeight: 700, marginTop: 8, color: type === "credit" && a.balance > 0 ? T.brick : T.ink }}>
                      {fmtMoney(a.balance, currency)}
                    </div>
                    {type === "credit" && (
                      <div style={{ marginTop: 6, fontSize: 12, color: T.inkSoft }}>
                        Limit {fmtMoney(a.creditLimit || 0, currency)} · Available <span style={{ color: T.gold, fontWeight: 700 }}>{fmtMoney((a.creditLimit || 0) - a.balance, currency)}</span>
                      </div>
                    )}
                    {a.note && <div style={{ marginTop: 8, fontSize: 12, color: T.inkSoft, fontStyle: "italic" }}>"{a.note}"</div>}
                  </Card>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {showForm && (
        <AccountForm
          editing={editing}
          onClose={() => setShowForm(false)}
          onSave={(payload) => {
            if (editing) onUpdate(editing.id, payload);
            else onAdd(payload);
            setShowForm(false);
          }}
        />
      )}
    </div>
  );
}

function AccountForm({ editing, onClose, onSave }) {
  const [type, setType] = useState(editing?.type || "cash");
  const [name, setName] = useState(editing?.name || "");
  const [institution, setInstitution] = useState(editing?.institution || "");
  const [balance, setBalance] = useState(editing ? String(editing.startingBalance) : "");
  const [creditLimit, setCreditLimit] = useState(editing?.creditLimit != null ? String(editing.creditLimit) : "");
  const [note, setNote] = useState(editing?.note || "");
  const [error, setError] = useState("");

  const submit = () => {
    if (!name.trim()) { setError("Please give the account a name."); return; }
    if (type === "credit" && Number(creditLimit) < 0) { setError("Credit limit can't be negative."); return; }
    if (type === "credit" && Number(balance) > Number(creditLimit || 0) && Number(creditLimit) > 0) {
      setError("Amount owed can't exceed the credit limit.");
      return;
    }
    onSave({
      type, name: name.trim(), institution: institution.trim(),
      startingBalance: Number(balance) || 0,
      creditLimit: type === "credit" ? Number(creditLimit) || 0 : undefined,
      note: note.trim(),
    });
  };

  return (
    <Modal title={editing ? "Edit account" : "New account"} onClose={onClose}>
      {!editing && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {[{v:"cash",l:"Cash / Bank",i:Wallet},{v:"savings",l:"Savings",i:PiggyBank},{v:"credit",l:"Credit Card",i:CreditCard}].map(o => (
            <button key={o.v} onClick={() => setType(o.v)} style={{
              flex: 1, padding: "10px 6px", borderRadius: 12, cursor: "pointer", textAlign: "center",
              border: `1.5px solid ${type === o.v ? T.teal : T.line}`, background: type === o.v ? T.tealSoft : "#fff",
            }}>
              <o.i size={16} style={{ margin: "0 auto 4px" }} color={type === o.v ? T.teal : T.inkSoft} />
              <div style={{ fontSize: 11.5, fontWeight: 600 }}>{o.l}</div>
            </button>
          ))}
        </div>
      )}
      <Field label="Account name"><TextInput value={name} onChange={e => setName(e.target.value)} placeholder="e.g. CIBC Chequing" /></Field>
      <Field label="Bank / institution (optional)"><TextInput value={institution} onChange={e => setInstitution(e.target.value)} /></Field>
      <Field label={type === "credit" ? "Amount currently owed" : "Current balance"}>
        <TextInput type="number" value={balance} onChange={e => setBalance(e.target.value)} placeholder="0.00" />
      </Field>
      {type === "credit" && (
        <Field label="Credit limit"><TextInput type="number" value={creditLimit} onChange={e => setCreditLimit(e.target.value)} placeholder="0.00" /></Field>
      )}
      <Field label="Note (optional)"><TextArea value={note} onChange={e => setNote(e.target.value)} /></Field>
      {error && <div style={{ background: T.brickSoft, color: T.brick, padding: "8px 12px", borderRadius: 10, fontSize: 13, marginBottom: 12 }}>{error}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <Btn variant="outline" style={{ flex: 1, justifyContent: "center" }} onClick={onClose}>Cancel</Btn>
        <Btn variant="accent" style={{ flex: 1, justifyContent: "center" }} onClick={submit}>{editing ? "Save changes" : "Create account"}</Btn>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------------------- */
/* Notes tab                                                               */
/* ---------------------------------------------------------------------- */
function NotesTab({ notes, accounts, currency, onAdd, onUpdate, onDelete }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [q, setQ] = useState("");
  const accountsById = Object.fromEntries(accounts.map(a => [a.id, a]));
  const filtered = notes.filter(n => !q || [n.title, n.note, n.tag].filter(Boolean).some(f => f.toLowerCase().includes(q.toLowerCase())));

  return (
    <div style={{ paddingTop: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 8, flexWrap: "wrap" }}>
        <div style={{ fontFamily: "Fraunces, serif", fontSize: 20, fontWeight: 600 }}>Notes</div>
        <Btn variant="accent" size="sm" onClick={() => { setEditing(null); setShowForm(true); }}><Plus size={14} /> New note</Btn>
      </div>
      <TextInput placeholder="Search notes…" value={q} onChange={e => setQ(e.target.value)} style={{ marginBottom: 14 }} />
      {filtered.length === 0 ? (
        <EmptyState Icon={StickyNote} title="No notes yet" body="Jot down anything that isn't a transaction — reminders, explanations, plans." />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px,1fr))", gap: 10 }}>
          {filtered.map(n => (
            <Card key={n.id} style={{ padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div style={{ fontWeight: 700, fontSize: 14.5 }}>{n.title || "Untitled"}</div>
                <div style={{ display: "flex", gap: 2 }}>
                  <IconButton Icon={Pencil} onClick={() => { setEditing(n); setShowForm(true); }} title="Edit" />
                  <IconButton Icon={Trash2} onClick={() => onDelete(n)} title="Delete" color={T.brick} />
                </div>
              </div>
              <div style={{ fontSize: 13, color: T.inkSoft, margin: "6px 0" }}>{n.note}</div>
              <div style={{ display: "flex", gap: 8, fontSize: 11.5, color: "#9AA6A0", flexWrap: "wrap" }}>
                <span>{n.date}</span>
                {n.relatedAccountId && accountsById[n.relatedAccountId] && <span>· {accountsById[n.relatedAccountId].name}</span>}
                {n.amount != null && n.amount !== "" && <span className="num">· {fmtMoney(Number(n.amount), currency)}</span>}
                {n.tag && <span>· #{n.tag}</span>}
              </div>
            </Card>
          ))}
        </div>
      )}
      {showForm && (
        <NoteForm accounts={accounts} editing={editing} onClose={() => setShowForm(false)}
          onSave={(payload) => { if (editing) onUpdate(editing.id, payload); else onAdd(payload); setShowForm(false); }} />
      )}
    </div>
  );
}

function NoteForm({ accounts, editing, onClose, onSave }) {
  const [title, setTitle] = useState(editing?.title || "");
  const [note, setNote] = useState(editing?.note || "");
  const [date, setDate] = useState(editing?.date || todayStr());
  const [relatedAccountId, setRelatedAccountId] = useState(editing?.relatedAccountId || "");
  const [amount, setAmount] = useState(editing?.amount != null ? String(editing.amount) : "");
  const [tag, setTag] = useState(editing?.tag || "");

  const submit = () => {
    if (!title.trim() && !note.trim()) return;
    onSave({ title: title.trim(), note: note.trim(), date, relatedAccountId: relatedAccountId || undefined, amount: amount === "" ? undefined : Number(amount), tag: tag.trim() });
  };

  return (
    <Modal title={editing ? "Edit note" : "New note"} onClose={onClose}>
      <Field label="Title"><TextInput value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Insurance refund" /></Field>
      <Field label="Note"><TextArea value={note} onChange={e => setNote(e.target.value)} placeholder="Details…" /></Field>
      <Field label="Date"><TextInput type="date" value={date} onChange={e => setDate(e.target.value)} /></Field>
      <Field label="Related account (optional)">
        <Select value={relatedAccountId} onChange={e => setRelatedAccountId(e.target.value)}>
          <option value="">None</option>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </Select>
      </Field>
      <Field label="Amount (optional)"><TextInput type="number" value={amount} onChange={e => setAmount(e.target.value)} /></Field>
      <Field label="Tag (optional)"><TextInput value={tag} onChange={e => setTag(e.target.value)} placeholder="e.g. tax, reminder" /></Field>
      <div style={{ display: "flex", gap: 8 }}>
        <Btn variant="outline" style={{ flex: 1, justifyContent: "center" }} onClick={onClose}>Cancel</Btn>
        <Btn variant="accent" style={{ flex: 1, justifyContent: "center" }} onClick={submit}>{editing ? "Save changes" : "Add note"}</Btn>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------------------- */
/* Recurring transactions                                                  */
/* ---------------------------------------------------------------------- */
function RecurringTab({ rules, accounts, categories, settings, currency, onAdd, onUpdate, onToggle, onDelete }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const accountsById = Object.fromEntries(accounts.map(a => [a.id, a]));
  const catsById = Object.fromEntries(categories.map(c => [c.id, c]));
  const sorted = [...rules].sort((a, b) => (a.active === b.active ? a.nextDate.localeCompare(b.nextDate) : a.active ? -1 : 1));

  return (
    <div style={{ paddingTop: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <div style={{ fontFamily: "Fraunces, serif", fontSize: 20, fontWeight: 600 }}>Recurring transactions</div>
        <Btn variant="accent" size="sm" onClick={() => { setEditing(null); setShowForm(true); }}><Plus size={14} /> New</Btn>
      </div>
      <div style={{ fontSize: 13, color: T.inkSoft, marginBottom: 16 }}>
        Rent, subscriptions, insurance, phone bills — set them once and they'll post automatically on schedule.
      </div>

      {sorted.length === 0 ? (
        <EmptyState Icon={CalendarClock} title="No recurring transactions yet" body="Add rent, Fido, insurance, or any subscription so it posts on its own each period." />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px,1fr))", gap: 10 }}>
          {sorted.map(r => {
            const info = TX_TYPES[r.type] || {};
            const acct = accountsById[r.fromAccountId] || accountsById[r.toAccountId];
            const cat = catsById[r.category];
            return (
              <Card key={r.id} style={{ padding: 14, opacity: r.active ? 1 : 0.55 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14.5 }}>{r.name}</div>
                    <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>{info.label}{cat ? " · " + cat.name : ""}{acct ? " · " + acct.name : ""}</div>
                  </div>
                  <div style={{ display: "flex", gap: 2 }}>
                    <IconButton Icon={r.active ? Pause : Play} onClick={() => onToggle(r)} title={r.active ? "Pause" : "Resume"} />
                    <IconButton Icon={Pencil} onClick={() => { setEditing(r); setShowForm(true); }} title="Edit" />
                    <IconButton Icon={Trash2} onClick={() => onDelete(r)} title="Delete" color={T.brick} />
                  </div>
                </div>
                <div className="num" style={{ fontSize: 20, fontWeight: 700, marginTop: 8 }}>{fmtMoney(r.amount, currency)}</div>
                <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 4, display: "flex", alignItems: "center", gap: 5 }}>
                  <Repeat size={12} /> {FREQUENCIES[r.frequency]?.label} · next {r.active ? r.nextDate : "paused"}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {showForm && (
        <RecurringForm
          accounts={accounts} categories={categories}
          editing={editing}
          onClose={() => setShowForm(false)}
          onSave={(payload) => { if (editing) onUpdate(editing.id, payload); else onAdd(payload); setShowForm(false); }}
        />
      )}
    </div>
  );
}

function RecurringForm({ accounts, categories, editing, onClose, onSave }) {
  const [name, setName] = useState(editing?.name || "");
  const [type, setType] = useState(editing?.type || "expense");
  const [amount, setAmount] = useState(editing ? String(editing.amount) : "");
  const [frequency, setFrequency] = useState(editing?.frequency || "monthly");
  const [startDate, setStartDate] = useState(editing?.nextDate || todayStr());
  const [fromAccountId, setFromAccountId] = useState(editing?.fromAccountId || accounts[0]?.id || "");
  const [toAccountId, setToAccountId] = useState(editing?.toAccountId || "");
  const [category, setCategory] = useState(editing?.category || categories[0]?.id || "");
  const [note, setNote] = useState(editing?.note || "");
  const [error, setError] = useState("");

  const info = TX_TYPES[type];
  const shape = info.shape;
  let fromOptions = accounts, toOptions = accounts;
  if (type === "expense") fromOptions = accounts.filter(a => a.type !== "credit");
  if (type === "cc_purchase") fromOptions = accounts.filter(a => a.type === "credit");
  if (type === "income") toOptions = accounts.filter(a => a.type !== "credit");
  if (type === "savings_add") { fromOptions = accounts.filter(a => a.type !== "credit"); toOptions = accounts.filter(a => a.type === "savings"); }
  if (type === "savings_withdraw") { fromOptions = accounts.filter(a => a.type === "savings"); toOptions = accounts.filter(a => a.type !== "credit"); }
  if (type === "cc_payment") { fromOptions = accounts.filter(a => a.type !== "credit"); toOptions = accounts.filter(a => a.type === "credit"); }

  const submit = () => {
    setError("");
    const amt = Number(amount);
    if (!name.trim()) { setError("Give this a name, e.g. \"Rent\" or \"Fido\"."); return; }
    if (!amount || isNaN(amt) || amt <= 0) { setError("Enter a valid amount greater than zero."); return; }
    if (!startDate) { setError("Choose a start date."); return; }
    if (type === "income" && !fromAccountId) { setError("Choose an account."); return; }
    if ((shape === "single") && !fromAccountId) { setError("Choose an account."); return; }
    if (shape === "pair" && (!fromAccountId || !toAccountId)) { setError("Choose both accounts."); return; }
    if (info.needsCategory && !category) { setError("Choose a category."); return; }
    onSave({
      name: name.trim(), type, amount: amt, frequency, nextDate: startDate,
      fromAccountId: type === "income" ? undefined : fromAccountId,
      toAccountId: type === "income" ? fromAccountId : (shape === "pair" ? toAccountId : undefined),
      category: info.needsCategory ? category : undefined,
      note: note.trim(), active: editing?.active ?? true,
    });
  };

  return (
    <Modal title={editing ? "Edit recurring transaction" : "New recurring transaction"} onClose={onClose}>
      <Field label="Name"><TextInput value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Rent, Fido, Netflix" /></Field>
      <Field label="Type">
        <Select value={type} onChange={e => setType(e.target.value)}>
          {["expense", "income", "cc_purchase", "cc_payment", "savings_add", "savings_withdraw"].map(k => <option key={k} value={k}>{TX_TYPES[k].label}</option>)}
        </Select>
      </Field>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}><Field label="Amount"><TextInput type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" /></Field></div>
        <div style={{ flex: 1 }}><Field label="Frequency">
          <Select value={frequency} onChange={e => setFrequency(e.target.value)}>
            {Object.entries(FREQUENCIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </Select>
        </Field></div>
      </div>
      <Field label={editing ? "Next occurrence" : "Start date"} hint="Future-dated rules will start posting once this date arrives.">
        <TextInput type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
      </Field>
      {(type === "income") && (
        <Field label="Account"><Select value={fromAccountId} onChange={e => setFromAccountId(e.target.value)}>
          {toOptions.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </Select></Field>
      )}
      {shape === "single" && type !== "income" && (
        <Field label="Account"><Select value={fromAccountId} onChange={e => setFromAccountId(e.target.value)}>
          {fromOptions.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </Select></Field>
      )}
      {shape === "pair" && (
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ flex: 1 }}><Field label="From"><Select value={fromAccountId} onChange={e => setFromAccountId(e.target.value)}>
            {fromOptions.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select></Field></div>
          <ArrowRightLeft size={16} color={T.inkSoft} style={{ marginTop: 14 }} />
          <div style={{ flex: 1 }}><Field label="To"><Select value={toAccountId} onChange={e => setToAccountId(e.target.value)}>
            {toOptions.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select></Field></div>
        </div>
      )}
      {info.needsCategory && (
        <Field label="Category">
          <Select value={category} onChange={e => setCategory(e.target.value)}>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
      )}
      <Field label="Note (optional)"><TextArea value={note} onChange={e => setNote(e.target.value)} /></Field>
      {error && <div style={{ background: T.brickSoft, color: T.brick, padding: "8px 12px", borderRadius: 10, fontSize: 13, marginBottom: 12 }}>{error}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <Btn variant="outline" style={{ flex: 1, justifyContent: "center" }} onClick={onClose}>Cancel</Btn>
        <Btn variant="accent" style={{ flex: 1, justifyContent: "center" }} onClick={submit}>{editing ? "Save changes" : "Create recurring transaction"}</Btn>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------------------- */
/* Reports / export / backup                                               */
/* ---------------------------------------------------------------------- */
function ReportsTab({ data, currency, showToast, setData }) {
  const fileInputRef = useRef(null);
  const [importPreview, setImportPreview] = useState(null);

  const accountsWithBalance = data.accounts.filter(a => !a.archived).map(a => ({ ...a, balance: computeBalance(a, data.transactions) }));
  const accountsById = Object.fromEntries(data.accounts.map(a => [a.id, a]));
  const catsById = Object.fromEntries(data.categories.map(c => [c.id, c]));

  const buildWorkbook = () => {
    const wb = XLSX.utils.book_new();
    const accountsSheet = data.accounts.map(a => ({
      Name: a.name, Type: a.type, Institution: a.institution || "", Balance: computeBalance(a, data.transactions),
      "Credit Limit": a.creditLimit ?? "", Note: a.note || "", Archived: a.archived ? "Yes" : "No",
    }));
    const txSheet = data.transactions.map(t => ({
      Date: t.date, Type: TX_TYPES[t.type]?.label || t.type, Amount: t.amount,
      "From Account": accountsById[t.fromAccountId]?.name || "", "To Account": accountsById[t.toAccountId]?.name || "",
      Category: catsById[t.category]?.name || "", Description: t.description || "", Merchant: t.merchant || "",
      Note: t.note || "", Tags: t.tags || "",
    }));
    const spendingSheet = Object.entries(
      data.transactions.filter(isSpendingTx).reduce((acc, t) => { acc[t.category] = (acc[t.category] || 0) + t.amount; return acc; }, {})
    ).map(([catId, amt]) => ({ Category: catsById[catId]?.name || catId, "Total Spent": amt }));
    const ccSheet = data.accounts.filter(a => a.type === "credit").map(a => ({
      Name: a.name, "Credit Limit": a.creditLimit || 0, "Amount Owed": computeBalance(a, data.transactions),
      "Available Credit": (a.creditLimit || 0) - computeBalance(a, data.transactions),
    }));
    const savingsSheet = data.accounts.filter(a => a.type === "savings").map(a => ({ Name: a.name, Balance: computeBalance(a, data.transactions) }));
    const notesSheet = data.notes.map(n => ({
      Title: n.title, Note: n.note, Date: n.date, "Related Account": accountsById[n.relatedAccountId]?.name || "", Amount: n.amount ?? "", Tag: n.tag || "",
    }));

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(accountsSheet), "Accounts");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(txSheet), "Transactions");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(spendingSheet), "Spending");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ccSheet), "Credit Cards");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(savingsSheet), "Savings");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(notesSheet), "Notes");
    return wb;
  };

  const downloadFile = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportExcel = () => {
    const wb = buildWorkbook();
    const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    downloadFile(new Blob([out], { type: "application/octet-stream" }), `finance-export-${todayStr()}.xlsx`);
    showToast("Excel file downloaded");
  };

  const exportCSV = () => {
    const txSheet = data.transactions.map(t => ({
      Date: t.date, Type: TX_TYPES[t.type]?.label || t.type, Amount: t.amount,
      "From Account": accountsById[t.fromAccountId]?.name || "", "To Account": accountsById[t.toAccountId]?.name || "",
      Category: catsById[t.category]?.name || "", Description: t.description || "", Merchant: t.merchant || "", Note: t.note || "",
    }));
    const ws = XLSX.utils.json_to_sheet(txSheet);
    const csv = XLSX.utils.sheet_to_csv(ws);
    downloadFile(new Blob([csv], { type: "text/csv" }), `transactions-${todayStr()}.csv`);
    showToast("CSV downloaded");
  };

  const backup = () => {
    downloadFile(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), `finance-backup-${todayStr()}.json`);
    showToast("Backup downloaded");
  };

  const handleRestoreFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    try {
      const parsed = JSON.parse(text);
      if (!parsed.accounts || !parsed.transactions) throw new Error("bad shape");
      setImportPreview({ kind: "backup", parsed });
    } catch {
      showToast("Couldn't read that file — is it a valid backup?");
    }
    e.target.value = "";
  };

  const handleCSVImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    const wb = XLSX.read(text, { type: "string" });
    const first = wb.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[first]);
    setImportPreview({ kind: "csv", rows });
    e.target.value = "";
  };

  return (
    <div style={{ paddingTop: 4 }}>
      <div style={{ fontFamily: "Fraunces, serif", fontSize: 20, fontWeight: 600, marginBottom: 14 }}>Reports &amp; data</div>

      <Card style={{ padding: 18, marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Export your data</div>
        <div style={{ fontSize: 13, color: T.inkSoft, marginBottom: 14 }}>Download accounts, transactions, spending, credit cards, savings and notes.</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Btn variant="accent" onClick={exportExcel}><Download size={15} /> Export Excel (.xlsx)</Btn>
          <Btn variant="outline" onClick={exportCSV}><Download size={15} /> Export transactions (.csv)</Btn>
        </div>
      </Card>

      <Card style={{ padding: 18, marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Backup &amp; restore</div>
        <div style={{ fontSize: 13, color: T.inkSoft, marginBottom: 14 }}>Save a complete backup of everything, or restore from a previous one.</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Btn variant="outline" onClick={backup}><Download size={15} /> Download backup</Btn>
          <Btn variant="outline" onClick={() => fileInputRef.current?.click()}><Upload size={15} /> Restore backup</Btn>
          <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={handleRestoreFile} />
        </div>
      </Card>

      <Card style={{ padding: 18 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Import transactions from CSV</div>
        <div style={{ fontSize: 13, color: T.inkSoft, marginBottom: 14 }}>You'll see a preview before anything is added.</div>
        <label>
          <Btn variant="outline" onClick={() => document.getElementById("csv-import-input").click()}><Upload size={15} /> Choose CSV file</Btn>
          <input id="csv-import-input" type="file" accept=".csv" hidden onChange={handleCSVImport} />
        </label>
      </Card>

      {importPreview && (
        <ImportPreviewModal
          preview={importPreview}
          accounts={data.accounts}
          categories={data.categories}
          onCancel={() => setImportPreview(null)}
          onConfirmBackup={(parsed) => { setData(parsed); setImportPreview(null); showToast("Backup restored"); }}
          onConfirmCSV={(txs) => { setData(d => ({ ...d, transactions: [...txs, ...d.transactions] })); setImportPreview(null); showToast(`${txs.length} transactions imported`); }}
        />
      )}
    </div>
  );
}

function ImportPreviewModal({ preview, accounts, categories, onCancel, onConfirmBackup, onConfirmCSV }) {
  if (preview.kind === "backup") {
    const p = preview.parsed;
    return (
      <Modal title="Restore backup?" onClose={onCancel}>
        <div style={{ fontSize: 14, color: T.inkSoft, marginBottom: 14, lineHeight: 1.6 }}>
          This backup contains <b>{p.accounts?.length || 0}</b> accounts, <b>{p.transactions?.length || 0}</b> transactions, and <b>{p.notes?.length || 0}</b> notes.
          Restoring will <b>replace all current data</b> in the app.
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="outline" style={{ flex: 1, justifyContent: "center" }} onClick={onCancel}>Cancel</Btn>
          <Btn variant="danger" style={{ flex: 1, justifyContent: "center" }} onClick={() => onConfirmBackup(p)}>Replace all data</Btn>
        </div>
      </Modal>
    );
  }
  // CSV preview
  const rows = preview.rows.slice(0, 50);
  const mapped = rows.map(r => ({
    date: r.Date || r.date || todayStr(),
    amount: Math.abs(Number(r.Amount || r.amount || 0)),
    description: r.Description || r.description || "",
    type: "expense",
    category: categories[0]?.id,
    fromAccountId: accounts[0]?.id,
  })).filter(r => r.amount > 0);
  return (
    <Modal title="Preview CSV import" wide onClose={onCancel}>
      <div style={{ fontSize: 13, color: T.inkSoft, marginBottom: 10 }}>
        Found {rows.length} rows. Showing first {Math.min(10, mapped.length)}. All rows import as expenses against your first account/category — edit them afterward as needed.
      </div>
      <div style={{ maxHeight: 260, overflowY: "auto", border: `1px solid ${T.line}`, borderRadius: 10 }}>
        {mapped.slice(0, 10).map((r, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", borderBottom: `1px solid ${T.line}`, fontSize: 13 }}>
            <span>{r.date} — {r.description || "—"}</span><span className="num">{fmtMoney(r.amount)}</span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <Btn variant="outline" style={{ flex: 1, justifyContent: "center" }} onClick={onCancel}>Cancel</Btn>
        <Btn variant="accent" style={{ flex: 1, justifyContent: "center" }} onClick={() => onConfirmCSV(mapped.map(m => ({ id: uid(), createdAt: Date.now(), ...m })))}>Import {mapped.length} transactions</Btn>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------------------- */
/* Settings tab                                                            */
/* ---------------------------------------------------------------------- */
function SettingsTab({
  currency,
  setCurrency,
  categories,
  onAddCategory,
  onUpdateCategory,
  accounts,
  onLogout
}) {
  const [newCat, setNewCat] = useState("");
  const iconKeys = Object.keys(CATEGORY_ICONS);

  return (
    <div style={{ paddingTop: 4 }}>
      <div style={{ fontFamily: "Fraunces, serif", fontSize: 20, fontWeight: 600, marginBottom: 14 }}>Settings</div>

      <Card style={{ padding: 18, marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>Currency</div>
        <Select value={currency} onChange={e => setCurrency(e.target.value)} style={{ maxWidth: 220 }}>
          {["CAD", "USD", "SAR", "PKR", "EUR", "GBP"].map(c => <option key={c} value={c}>{c}</option>)}
        </Select>
      </Card>

      <Card style={{ padding: 18, marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>Categories &amp; icons</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px,1fr))", gap: 8, marginBottom: 14 }}>
          {categories.map(c => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, border: `1px solid ${T.line}`, borderRadius: 10, padding: "7px 9px" }}>
              <select value={c.icon} onChange={e => onUpdateCategory(c.id, { icon: e.target.value })} style={{ border: "none", background: "none", cursor: "pointer" }}>
                {iconKeys.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
              <CategoryIcon catId={c.icon} size={15} />
              <span style={{ fontSize: 12.5, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <TextInput placeholder="New category name" value={newCat} onChange={e => setNewCat(e.target.value)} />
          <Btn variant="outline" onClick={() => { if (newCat.trim()) { onAddCategory({ name: newCat.trim() }); setNewCat(""); } }}>Add</Btn>
        </div>
      </Card>

      <Card style={{ padding: 18, marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>Accounts &amp; data</div>
        <div style={{ fontSize: 13, color: T.inkSoft }}>{accounts.length} active account{accounts.length === 1 ? "" : "s"}. Manage them from the Accounts tab. Export and backups are in Reports.</div>
      </Card>

      <Card style={{ padding: 18, marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>
          Account
        </div>
        <div style={{ fontSize: 13, color: T.inkSoft, marginBottom: 14 }}>
          Sign out of your Ledger account on this device.
        </div>
        <Btn variant="outline" onClick={() => supabase.auth.signOut()}>
          Log out
        </Btn>
      </Card>

      <Card style={{ padding: 18 }}>
        <div style={{ display: "flex", gap: 10 }}>
          <IconBadge Icon={Info} bg={T.steelSoft} fg={T.steel} />
          <div style={{ fontSize: 13, color: T.inkSoft, lineHeight: 1.6 }}>
            <b style={{ color: T.ink }}>About access &amp; security.</b> {hasClaudeStorage
              ? "Your data is stored privately under your Claude.ai account and is available wherever you're signed in — no separate password to manage."
              : "Your data is stored only in this browser's local storage. It won't appear on other devices unless you export a backup (Reports tab) and restore it there — clearing this browser's data will erase it, so back up regularly."}
            {" "}It is not a bank-grade financial system: don't store full card numbers, banking passwords, or SSNs in notes or descriptions. Use rounded balances and account nicknames instead of real account numbers.
          </div>
        </div>
      </Card>
    </div>
  );
}
