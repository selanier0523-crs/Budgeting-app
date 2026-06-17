import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { usePlaidLink } from "react-plaid-link";
import {
  BarChart3,
  CalendarDays,
  Cloud,
  CircleDollarSign,
  Copy,
  Download,
  HandCoins,
  Home,
  Landmark,
  LineChart,
  PiggyBank,
  Plus,
  Repeat2,
  RotateCcw,
  Search,
  Settings,
  Smartphone,
  Target,
  Trash2,
  Upload,
  UserRound,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { useBudget } from "./lib/useBudget";
import {
  calculateSavingsBuckets,
  calculateBudget,
  createId,
  downloadJson,
  getAvailableYears,
  getReimbursementComputed,
  getTransactionBudgetAmount,
  getTransactionBucketAmount,
  getTransactionReimbursementComputed,
  getYearlySpendingSummary,
  inMonth,
  mergeBudgetData,
  monthLabel,
  sortRecordsByDateDesc,
  toCurrency,
  toShortDate,
  todayISO,
} from "./lib/budgetData";
import { supabase } from "./lib/supabaseClient";
import "./styles.css";

const tabs = [
  { id: "dashboard", label: "Dashboard", icon: Home },
  { id: "transactions", label: "Spending", icon: WalletCards },
  { id: "income", label: "Income", icon: CircleDollarSign },
  { id: "savings", label: "Savings", icon: PiggyBank },
  { id: "buckets", label: "Buckets", icon: Landmark },
  { id: "imports", label: "Imports", icon: Upload },
  { id: "reimbursements", label: "Owed To Me", icon: HandCoins },
  { id: "summaries", label: "Summaries", icon: LineChart },
  { id: "household", label: "Household", icon: UsersRound },
  { id: "settings", label: "Settings", icon: Settings },
  { id: "account", label: "Account", icon: UserRound },
];

const SpendingCategoryChart = lazy(() =>
  import("./components/DashboardCharts").then((module) => ({ default: module.SpendingCategoryChart })),
);
const WeeklyTrendChart = lazy(() => import("./components/DashboardCharts").then((module) => ({ default: module.WeeklyTrendChart })));
const SavingsLocationChart = lazy(() =>
  import("./components/DashboardCharts").then((module) => ({ default: module.SavingsLocationChart })),
);

function App() {
  const budgetState = useBudget();
  const { data, user, syncStatus, selectedMonth, setSelectedMonth, months, budget, addRecord, importData } = budgetState;
  const [activeTab, setActiveTab] = useState("dashboard");
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const importInputRef = useRef(null);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/service-worker.js").catch(() => {});
    }

    function handleBeforeInstallPrompt(event) {
      event.preventDefault();
      setInstallPrompt(event);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  async function installApp() {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  async function handleImportFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      importData(JSON.parse(text));
    } catch {
      alert("That file could not be imported. Use a JSON backup exported from this app.");
    } finally {
      event.target.value = "";
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <PiggyBank size={24} />
          </div>
          <div>
            <strong>Budget Tracker</strong>
            <span>Personal money map</span>
          </div>
        </div>
        <nav className="nav-list" aria-label="Primary">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} className={activeTab === tab.id ? "active" : ""} onClick={() => setActiveTab(tab.id)}>
                <Icon size={18} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
        <button className="quick-button" onClick={() => setQuickAddOpen(true)}>
          <Plus size={18} />
          Quick Add
        </button>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">{monthLabel(selectedMonth)}</p>
            <h1>{tabs.find((tab) => tab.id === activeTab)?.label}</h1>
            <p className="sync-line">
              <Cloud size={14} />
              {user ? `${user.email} | ${syncStatus}` : syncStatus}
            </p>
          </div>
          <div className="topbar-actions">
            <label className="month-picker">
              <span>Month</span>
              <select value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} aria-label="Selected month">
                {months.map((month) => (
                  <option key={month} value={month}>
                    {monthLabel(month)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </header>

        {activeTab === "dashboard" && <Dashboard data={data} budget={budget} selectedMonth={selectedMonth} />}
        {activeTab === "transactions" && <RecordScreen title="Spending" type="transactions" budgetState={budgetState} selectedMonth={selectedMonth} />}
        {activeTab === "income" && <RecordScreen title="Income" type="income" budgetState={budgetState} selectedMonth={selectedMonth} />}
        {activeTab === "savings" && <RecordScreen title="Savings" type="savings" budgetState={budgetState} selectedMonth={selectedMonth} />}
        {activeTab === "buckets" && <BucketsScreen budgetState={budgetState} />}
        {activeTab === "imports" && <ImportsScreen budgetState={budgetState} />}
        {activeTab === "reimbursements" && <RecordScreen title="Owed To Me" type="reimbursements" budgetState={budgetState} selectedMonth={selectedMonth} />}
        {activeTab === "summaries" && <Summaries data={data} budget={budget} selectedMonth={selectedMonth} />}
        {activeTab === "household" && <HouseholdScreen budgetState={budgetState} selectedMonth={selectedMonth} />}
        {activeTab === "settings" && (
          <SettingsScreen
            budgetState={budgetState}
            importInputRef={importInputRef}
            onExport={() => downloadJson(data)}
            onImportClick={() => importInputRef.current?.click()}
            onImportFile={handleImportFile}
            installPrompt={installPrompt}
            onInstall={installApp}
            onOpenImports={() => setActiveTab("imports")}
          />
        )}
        {activeTab === "account" && <AccountScreen budgetState={budgetState} />}
      </main>

      {quickAddOpen && (
        <QuickAdd
          data={data}
          onClose={() => setQuickAddOpen(false)}
          onAdd={(type, record) => {
            addRecord(type, record);
            setQuickAddOpen(false);
          }}
        />
      )}
    </div>
  );
}

function Dashboard({ data, budget, selectedMonth }) {
  const visibleCategories = budget.categorySpending.filter((item) => item.amount > 0);
  const visibleSavings = budget.savingsByLocation.filter((item) => item.amount > 0);
  const recentTransactions = budget.monthlyTransactions.slice(0, 5);
  const openReimbursements = sortRecordsByDateDesc(
    budget.monthlyReimbursements.filter((item) => getReimbursementComputed(item).stillOwed > 0),
    "reimbursements",
  );

  return (
    <div className="page-stack">
      <section className="kpi-grid">
        <Kpi label="Income" value={toCurrency(budget.incomeTotal)} icon={CircleDollarSign} tone="green" />
        <Kpi label="Spending" value={toCurrency(budget.spendingTotal)} icon={WalletCards} tone="blue" />
        <Kpi label="Saved" value={toCurrency(budget.savingsTotal)} icon={PiggyBank} tone="amber" />
        <Kpi label="Leftover" value={toCurrency(budget.leftover)} icon={Landmark} tone={budget.leftover >= 0 ? "green" : "rose"} />
        <Kpi label="Still Owed" value={toCurrency(budget.owedTotal)} icon={HandCoins} tone="purple" />
      </section>

      <section className="dashboard-grid">
        <Panel title="Spending By Category" icon={BarChart3}>
          <ChartEmpty visible={visibleCategories.length === 0} />
          {visibleCategories.length > 0 && (
            <Suspense fallback={<ChartLoading />}>
              <SpendingCategoryChart data={visibleCategories} />
            </Suspense>
          )}
        </Panel>

        <Panel title="Income, Spending, Savings" icon={LineChart}>
          <Suspense fallback={<ChartLoading />}>
            <WeeklyTrendChart data={budget.weekly} />
          </Suspense>
        </Panel>

        <Panel title="Savings By Location" icon={PiggyBank}>
          <ChartEmpty visible={visibleSavings.length === 0} />
          {visibleSavings.length > 0 && (
            <Suspense fallback={<ChartLoading />}>
              <SavingsLocationChart data={visibleSavings} />
            </Suspense>
          )}
        </Panel>

        <Panel title="Budget Targets" icon={Target}>
          <div className="progress-list">
            <ProgressRow
              label="Monthly Savings"
              spent={budget.savingsProgress.saved}
              budget={budget.savingsProgress.goal}
              remaining={budget.savingsProgress.remaining}
              kind="savings"
            />
            {budget.categoryBudgets
              .filter((item) => item.budget > 0 || item.spent > 0)
              .slice(0, 6)
              .map((item) => (
                <ProgressRow
                  key={item.name}
                  label={item.name}
                  spent={item.spent}
                  budget={item.budget}
                  remaining={item.remaining}
                  detail={[
                    item.reimbursed > 0 ? `${toCurrency(item.reimbursed)} paid back` : "",
                    item.bucketUsed > 0 ? `${toCurrency(item.bucketUsed)} from buckets` : "",
                  ].filter(Boolean).join(" | ")}
                />
              ))}
          </div>
        </Panel>

        <Panel title="Month Review" icon={LineChart}>
          <div className="insight-list">
            {budget.insights.map((insight) => (
              <div className="insight" key={insight}>
                {insight}
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Recent Activity" icon={CalendarDays}>
          <div className="mini-list">
            {recentTransactions.map((item) => (
              <div className="mini-row" key={item.id}>
                <div>
                  <strong>{item.description}</strong>
                  <span>{toShortDate(item.date)} · {item.category}</span>
                </div>
                <b>{toCurrency(getTransactionBudgetAmount(item))}</b>
              </div>
            ))}
            {recentTransactions.length === 0 && <p className="empty-text">No spending entered for {monthLabel(selectedMonth)}.</p>}
          </div>
          <div className="subsection">
            <h3>Open Reimbursements</h3>
            {openReimbursements.slice(0, 4).map((item) => {
              const computed = getReimbursementComputed(item);
              return (
                <div className="mini-row" key={item.id}>
                  <div>
                    <strong>{item.person}</strong>
                    <span>{item.description}</span>
                  </div>
                  <b>{toCurrency(computed.stillOwed)}</b>
                </div>
              );
            })}
            {openReimbursements.length === 0 && <p className="empty-text">Nobody currently owes you money.</p>}
          </div>
        </Panel>
      </section>
    </div>
  );
}

function ProgressRow({ label, spent, budget, remaining, detail = "", kind = "spending" }) {
  const percent = budget > 0 ? Math.min(Math.round((spent / budget) * 100), 999) : 0;
  const isOver = kind === "spending" && budget > 0 && spent > budget;
  const isSavingsMet = kind === "savings" && budget > 0 && spent >= budget;

  return (
    <div className="progress-row">
      <div className="progress-heading">
        <strong>{label}</strong>
        <span>
          {toCurrency(spent)} / {toCurrency(budget)}
        </span>
      </div>
      <div className="progress-track" aria-label={`${label} progress`}>
        <div className={isOver ? "over" : isSavingsMet ? "met" : ""} style={{ width: `${Math.min(percent, 100)}%` }} />
      </div>
      <small className={isOver ? "negative" : isSavingsMet ? "positive" : ""}>
        {kind === "savings"
          ? remaining <= 0
            ? `${toCurrency(Math.abs(remaining))} over goal`
            : `${toCurrency(remaining)} left to save`
          : remaining < 0
            ? `${toCurrency(Math.abs(remaining))} over budget`
            : `${toCurrency(remaining)} left`}
      </small>
      {detail && <small>{detail}</small>}
    </div>
  );
}

function Kpi({ label, value, icon: Icon, tone }) {
  return (
    <article className={`kpi ${tone}`}>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <Icon size={24} />
    </article>
  );
}

function Panel({ title, icon: Icon, children }) {
  return (
    <section className="panel">
      <div className="panel-title">
        <Icon size={18} />
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}

function ChartEmpty({ visible }) {
  return visible ? <div className="chart-empty">No data yet for this month.</div> : null;
}

function ChartLoading() {
  return <div className="chart-empty">Loading chart...</div>;
}

function RecordScreen({ title, type, budgetState, selectedMonth }) {
  const { data, addRecord, updateRecord, deleteRecord, duplicateRecord } = budgetState;
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null);
  const rows = data[type].filter((item) => inMonth(item, selectedMonth, type === "reimbursements" ? "datePaid" : "date"));
  const filteredRows = useMemo(() => {
    const text = query.toLowerCase();
    return sortRecordsByDateDesc(
      rows.filter((item) => JSON.stringify(item).toLowerCase().includes(text)),
      type,
    );
  }, [rows, query, type]);

  return (
    <div className="page-stack">
      <section className="toolbar-band">
        <div className="search-box">
          <Search size={18} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${title.toLowerCase()}`} />
        </div>
        <button className="primary" onClick={() => setEditing({})}>
          <Plus size={18} />
          Add {addButtonLabel(type)}
        </button>
      </section>

      <section className="panel">
        <EditableTable
          type={type}
          rows={filteredRows}
          lists={data.lists}
          buckets={data.savingsBuckets}
          emptyMessage={`No ${title.toLowerCase()} records found for ${monthLabel(selectedMonth)}.`}
          onEdit={setEditing}
          onDelete={(id) => deleteRecord(type, id)}
          onDuplicate={(record) => duplicateRecord(type, record)}
        />
      </section>

      {editing && (
        <RecordModal
          type={type}
          lists={data.lists}
          buckets={data.savingsBuckets}
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={(record) => {
            if (record.id) updateRecord(type, record.id, record);
            else addRecord(type, record);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function EditableTable({ type, rows, lists, buckets = [], emptyMessage = "No records found.", onEdit, onDelete, onDuplicate }) {
  if (rows.length === 0) return <p className="empty-text">{emptyMessage}</p>;
  const columns = getColumns(type);
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((column) => <th key={column.key}>{column.label}</th>)}
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const computed = type === "reimbursements" ? getReimbursementComputed(row) : null;
            const transactionComputed = type === "transactions" ? getTransactionReimbursementComputed(row) : null;
            return (
              <tr key={row.id}>
                {columns.map((column) => (
                  <td key={column.key}>{formatCell(row, column, computed, transactionComputed, buckets)}</td>
                ))}
                <td>
                  <div className="row-actions">
                    <button onClick={() => onDuplicate(row)} title="Duplicate">
                      <Repeat2 size={16} />
                    </button>
                    <button onClick={() => onEdit(row)}>Edit</button>
                    <button className="danger" onClick={() => onDelete(row.id)} title="Delete">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function getColumns(type) {
  const map = {
    transactions: [
      { key: "date", label: "Date", kind: "date" },
      { key: "description", label: "Description" },
      { key: "category", label: "Category" },
      { key: "amount", label: "Amount", kind: "money" },
      { key: "amountOwed", label: "Owed", kind: "money" },
      { key: "amountPaidBack", label: "Paid Back", kind: "money" },
      { key: "stillOwed", label: "Still Owed", kind: "transactionStillOwed" },
      { key: "savingsBucketId", label: "Bucket", kind: "bucket" },
      { key: "bucketAmountUsed", label: "Bucket Used", kind: "transactionBucketUsed" },
      { key: "netAmount", label: "Net", kind: "transactionNet" },
      { key: "budgetAmount", label: "Budget Counted", kind: "transactionBudget" },
      { key: "paymentMethod", label: "Payment" },
      { key: "personOwes", label: "Person" },
      { key: "reimbursementStatus", label: "Reimbursement", kind: "transactionStatus" },
      { key: "datePaidBack", label: "Paid Back Date", kind: "date" },
      { key: "reimbursementPaymentMethod", label: "Paid Back Via" },
      { key: "reimbursementNotes", label: "Notes" },
    ],
    income: [
      { key: "date", label: "Date", kind: "date" },
      { key: "source", label: "Source" },
      { key: "description", label: "Description" },
      { key: "amount", label: "Amount", kind: "money" },
      { key: "incomeType", label: "Type" },
      { key: "notes", label: "Notes" },
    ],
    savings: [
      { key: "date", label: "Date", kind: "date" },
      { key: "amount", label: "Amount", kind: "money" },
      { key: "location", label: "Saved To" },
      { key: "purpose", label: "Purpose" },
      { key: "bucketId", label: "Bucket", kind: "bucket" },
      { key: "notes", label: "Notes" },
    ],
    reimbursements: [
      { key: "datePaid", label: "Date Paid", kind: "date" },
      { key: "person", label: "Person" },
      { key: "description", label: "What" },
      { key: "amountPaid", label: "Paid", kind: "money" },
      { key: "amountPaidBack", label: "Paid Back", kind: "money" },
      { key: "stillOwed", label: "Still Owed", kind: "computedMoney" },
      { key: "status", label: "Status", kind: "status" },
    ],
  };
  return map[type];
}

function formatCell(row, column, computed, transactionComputed, buckets = []) {
  if (column.kind === "money") return toCurrency(row[column.key]);
  if (column.kind === "computedMoney") return toCurrency(computed.stillOwed);
  if (column.kind === "transactionStillOwed") return toCurrency(transactionComputed.stillOwed);
  if (column.kind === "transactionNet") return toCurrency(transactionComputed.netAmount);
  if (column.kind === "transactionBucketUsed") return toCurrency(getTransactionBucketAmount(row));
  if (column.kind === "transactionBudget") return toCurrency(getTransactionBudgetAmount(row));
  if (column.kind === "bucket") return bucketName(buckets, row[column.key]);
  if (column.kind === "date") return row[column.key] ? toShortDate(row[column.key]) : "";
  if (column.kind === "boolean") return row[column.key] ? "Yes" : "No";
  if (column.kind === "status") return <span className={`status ${computed.status.toLowerCase().replace(/\s+/g, "-")}`}>{computed.status}</span>;
  if (column.kind === "transactionStatus") {
    const className = transactionComputed.status.toLowerCase().replace(/\s+/g, "-");
    return <span className={`status ${className}`}>{transactionComputed.status}</span>;
  }
  return row[column.key] || "";
}

function bucketName(buckets = [], id) {
  if (!id) return "";
  return buckets.find((bucket) => bucket.id === id)?.name || "Deleted bucket";
}

function QuickAdd({ data, onClose, onAdd }) {
  const [type, setType] = useState("transactions");
  return (
    <RecordModal
      type={type}
      lists={data.lists}
      buckets={data.savingsBuckets}
      initial={{}}
      quickAdd
      onClose={onClose}
      onTypeChange={setType}
      onSave={(record) => onAdd(type, record)}
    />
  );
}

function RecordModal({ type, lists, buckets = [], initial, onClose, onSave, quickAdd = false, onTypeChange }) {
  const [record, setRecord] = useState(() => makeInitialRecord(type, initial, lists));

  function update(key, value) {
    setRecord((current) => ({ ...current, [key]: value }));
  }

  function submit(event) {
    event.preventDefault();
    onSave(normalizeRecord(type, record));
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <form className="modal" onSubmit={submit}>
        <div className="modal-header">
          <div>
            <p className="eyebrow">{quickAdd ? "Quick Add" : record.id ? "Edit" : "Add"}</p>
            <h2>{labelForType(type)}</h2>
          </div>
          <button type="button" className="ghost" onClick={onClose}>Close</button>
        </div>
        {quickAdd && (
          <div className="segmented">
            {["transactions", "income", "savings", "reimbursements"].map((item) => (
              <button
                type="button"
                className={type === item ? "active" : ""}
                key={item}
                onClick={() => {
                  onTypeChange(item);
                  setRecord(makeInitialRecord(item, {}, lists));
                }}
              >
                {labelForType(item)}
              </button>
            ))}
          </div>
        )}
        <div className="form-grid">{fieldsForType(type, lists, record, buckets).map((field) => (
          <Field key={field.key} field={field} value={record[field.key]} onChange={(value) => update(field.key, value)} />
        ))}</div>
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary">Save</button>
        </div>
      </form>
    </div>
  );
}

function labelForType(type) {
  return {
    transactions: "Expense",
    income: "Income",
    savings: "Savings",
    reimbursements: "Reimbursement",
  }[type];
}

function addButtonLabel(type) {
  return {
    transactions: "Expense",
    income: "Income",
    savings: "Savings",
    reimbursements: "Reimbursement",
  }[type];
}

function makeInitialRecord(type, initial, lists) {
  const base = {
    transactions: {
      date: todayISO(),
      description: "",
      category: lists.categories[0],
      amount: "",
      paymentMethod: lists.paymentMethods[0],
      paidForSomeone: false,
      personOwes: "",
      amountOwed: "",
      amountPaidBack: 0,
      datePaidBack: "",
      reimbursementPaymentMethod: "",
      reimbursementNotes: "",
      savingsBucketId: "",
      bucketAmountUsed: 0,
    },
    income: {
      date: todayISO(),
      source: "",
      description: "",
      amount: "",
      incomeType: lists.incomeTypes[0],
      notes: "",
    },
    savings: {
      date: todayISO(),
      amount: "",
      location: lists.savingsLocations[0],
      purpose: lists.savingsPurposes[0],
      bucketId: "",
      notes: "",
    },
    reimbursements: {
      datePaid: todayISO(),
      person: "",
      description: "",
      amountPaid: "",
      amountPaidBack: 0,
      datePaidBack: "",
    },
  };
  return { ...base[type], ...initial };
}

function normalizeRecord(type, record) {
  const next = { ...record };
  if (type === "transactions" || type === "income" || type === "savings") next.amount = Number(next.amount || 0);
  if (type === "transactions") {
    next.amountOwed = Number(next.amountOwed || 0);
    next.amountPaidBack = Number(next.amountPaidBack || 0);
    next.bucketAmountUsed = next.savingsBucketId ? Number(next.bucketAmountUsed || 0) : 0;
    if (!next.paidForSomeone) {
      next.personOwes = "";
      next.amountOwed = 0;
      next.amountPaidBack = 0;
      next.datePaidBack = "";
      next.reimbursementPaymentMethod = "";
    }
  }
  if (type === "reimbursements") {
    next.amountPaid = Number(next.amountPaid || 0);
    next.amountPaidBack = Number(next.amountPaidBack || 0);
  }
  return next;
}

function fieldsForType(type, lists, record = {}, buckets = []) {
  const bucketOptions = [
    { value: "", label: "No bucket" },
    ...buckets.map((bucket) => ({ value: bucket.id, label: bucket.name })),
  ];
  const fields = {
    transactions: [
      { key: "amount", label: "Amount", type: "number", required: true },
      { key: "description", label: "Description", required: true },
      { key: "category", label: "Category", type: "select", options: lists.categories },
      { key: "date", label: "Date", type: "date" },
      { key: "paymentMethod", label: "Payment Method", type: "select", options: lists.paymentMethods },
      { key: "savingsBucketId", label: "Paid From Savings Bucket", type: "select", options: bucketOptions },
      { key: "bucketAmountUsed", label: "Amount Covered By Bucket", type: "number", bucketOnly: true },
      { key: "paidForSomeone", label: "Paid For Someone", type: "checkbox" },
      { key: "personOwes", label: "Person Who Owes Me", reimbursementOnly: true, required: true },
      { key: "amountOwed", label: "Amount They Owe Me", type: "number", reimbursementOnly: true, required: true },
      { key: "amountPaidBack", label: "Amount Paid Back", type: "number", reimbursementOnly: true },
      { key: "datePaidBack", label: "Date Paid Back", type: "date", reimbursementOnly: true },
      { key: "reimbursementPaymentMethod", label: "Paid Back Via", type: "select", options: ["", ...lists.paymentMethods], reimbursementOnly: true },
      { key: "reimbursementNotes", label: "Reimbursement Notes", reimbursementOnly: true },
    ].filter((field) => (!field.reimbursementOnly || record.paidForSomeone) && (!field.bucketOnly || record.savingsBucketId)),
    income: [
      { key: "amount", label: "Amount", type: "number", required: true },
      { key: "source", label: "Source", required: true },
      { key: "description", label: "Description" },
      { key: "incomeType", label: "Income Type", type: "select", options: lists.incomeTypes },
      { key: "date", label: "Date", type: "date" },
      { key: "notes", label: "Notes" },
    ],
    savings: [
      { key: "amount", label: "Amount", type: "number", required: true },
      { key: "location", label: "Saved To", type: "select", options: lists.savingsLocations },
      { key: "purpose", label: "Purpose", type: "select", options: lists.savingsPurposes },
      { key: "bucketId", label: "Add To Bucket", type: "select", options: bucketOptions },
      { key: "date", label: "Date", type: "date" },
      { key: "notes", label: "Notes" },
    ],
    reimbursements: [
      { key: "person", label: "Person", required: true },
      { key: "amountPaid", label: "Amount Paid", type: "number", required: true },
      { key: "amountPaidBack", label: "Amount Paid Back", type: "number" },
      { key: "description", label: "What It Was For", required: true },
      { key: "datePaid", label: "Date I Paid", type: "date" },
      { key: "datePaidBack", label: "Date Paid Back", type: "date" },
    ],
  };
  return fields[type];
}

function Field({ field, value, onChange }) {
  if (field.type === "select") {
    return (
      <label>
        <span>{field.label}</span>
        <select value={value} onChange={(event) => onChange(event.target.value)} required={field.required}>
          {field.options.map((option) => {
            const normalized = typeof option === "string" ? { value: option, label: option } : option;
            return <option key={normalized.value} value={normalized.value}>{normalized.label}</option>;
          })}
        </select>
      </label>
    );
  }
  if (field.type === "checkbox") {
    return (
      <label className="check-field">
        <input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} />
        <span>{field.label}</span>
      </label>
    );
  }
  return (
    <label>
      <span>{field.label}</span>
      <input
        type={field.type || "text"}
        step={field.type === "number" ? "0.01" : undefined}
        value={value ?? ""}
        autoFocus={field.key === "amount"}
        onChange={(event) => onChange(event.target.value)}
        required={field.required}
      />
    </label>
  );
}

function BucketsScreen({ budgetState }) {
  const { data, addSavingsBucket, updateSavingsBucket, deleteSavingsBucket } = budgetState;
  const [editing, setEditing] = useState(null);
  const buckets = useMemo(() => calculateSavingsBuckets(data), [data]);
  const totalBalance = buckets.reduce((total, bucket) => total + bucket.balance, 0);
  const activeMonthly = buckets
    .filter((bucket) => bucket.status === "active")
    .reduce((total, bucket) => total + Number(bucket.monthlyContribution || 0), 0);
  const totalSpent = buckets.reduce((total, bucket) => total + bucket.spent, 0);
  const ledger = useMemo(() => {
    const bucketById = Object.fromEntries(buckets.map((bucket) => [bucket.id, bucket]));
    return [
      ...data.savings
        .filter((item) => item.bucketId)
        .map((item) => ({
          id: `sav-${item.id}`,
          date: item.date,
          bucket: bucketById[item.bucketId]?.name || "Deleted bucket",
          type: "Contribution",
          description: item.purpose || item.location,
          amount: Number(item.amount || 0),
        })),
      ...data.transactions
        .filter((item) => item.savingsBucketId && getTransactionBucketAmount(item) > 0)
        .map((item) => ({
          id: `tx-${item.id}`,
          date: item.date,
          bucket: bucketById[item.savingsBucketId]?.name || "Deleted bucket",
          type: "Spent From Bucket",
          description: item.description || item.category,
          amount: -getTransactionBucketAmount(item),
        })),
    ].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  }, [buckets, data.savings, data.transactions]);

  return (
    <div className="page-stack">
      <section className="kpi-grid bucket-kpis">
        <Kpi label="Bucket Balance" value={toCurrency(totalBalance)} icon={Landmark} tone="green" />
        <Kpi label="Monthly Planned" value={toCurrency(activeMonthly)} icon={PiggyBank} tone="amber" />
        <Kpi label="Spent From Buckets" value={toCurrency(totalSpent)} icon={WalletCards} tone="blue" />
      </section>

      <section className="toolbar-band">
        <div>
          <p className="eyebrow">Rollover Savings</p>
          <h2>Savings Buckets</h2>
        </div>
        <button className="primary" onClick={() => setEditing({})}>
          <Plus size={18} />
          Add Bucket
        </button>
      </section>

      <section className="bucket-grid">
        {buckets.map((bucket) => (
          <article className="bucket-card" key={bucket.id}>
            <div className="bucket-card-header">
              <div>
                <p className="eyebrow">{bucket.status === "paused" ? "Paused" : "Active"}</p>
                <h3>{bucket.name}</h3>
              </div>
              <span className={`status ${bucket.status === "paused" ? "partially-paid" : "paid"}`}>
                {bucket.status === "paused" ? "Paused" : "Active"}
              </span>
            </div>
            <ProgressRow
              label="Saved"
              spent={bucket.balance}
              budget={bucket.goalAmount}
              remaining={bucket.remaining}
              kind="savings"
            />
            <div className="bucket-meta">
              <span>Monthly: {toCurrency(bucket.monthlyContribution)}</span>
              <span>Added: {toCurrency(bucket.contributed)}</span>
              <span>Spent: {toCurrency(bucket.spent)}</span>
              {bucket.targetDate && <span>Target: {toShortDate(bucket.targetDate)}</span>}
            </div>
            {bucket.notes && <p className="empty-text">{bucket.notes}</p>}
            <div className="row-actions bucket-actions">
              <button onClick={() => setEditing(bucket)}>Edit</button>
              <button
                className="danger"
                onClick={() => {
                  const confirmed = window.confirm(`Delete ${bucket.name}? Linked savings and spending records will stay, but will no longer point to this bucket.`);
                  if (confirmed) deleteSavingsBucket(bucket.id);
                }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </article>
        ))}
        {buckets.length === 0 && (
          <section className="panel">
            <p className="empty-text">No savings buckets yet. Add one for trips, gifts, repairs, or any future expense you want to plan ahead for.</p>
          </section>
        )}
      </section>

      <Panel title="Bucket Activity" icon={CalendarDays}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Bucket</th>
                <th>Type</th>
                <th>Description</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((item) => (
                <tr key={item.id}>
                  <td>{toShortDate(item.date)}</td>
                  <td>{item.bucket}</td>
                  <td>{item.type}</td>
                  <td>{item.description}</td>
                  <td className={item.amount < 0 ? "negative" : "positive"}>{toCurrency(item.amount)}</td>
                </tr>
              ))}
              {ledger.length === 0 && (
                <tr>
                  <td colSpan="5">No bucket activity yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {editing && (
        <BucketModal
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={(bucket) => {
            if (bucket.id) updateSavingsBucket(bucket.id, bucket);
            else addSavingsBucket(bucket);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function BucketModal({ initial, onClose, onSave }) {
  const [bucket, setBucket] = useState(() => ({
    name: "",
    goalAmount: "",
    startingBalance: 0,
    monthlyContribution: "",
    targetDate: "",
    status: "active",
    notes: "",
    ...initial,
  }));

  function update(key, value) {
    setBucket((current) => ({ ...current, [key]: value }));
  }

  function submit(event) {
    event.preventDefault();
    onSave({
      ...bucket,
      goalAmount: Number(bucket.goalAmount || 0),
      startingBalance: Number(bucket.startingBalance || 0),
      monthlyContribution: Number(bucket.monthlyContribution || 0),
    });
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <form className="modal" onSubmit={submit}>
        <div className="modal-header">
          <div>
            <p className="eyebrow">{bucket.id ? "Edit" : "Add"}</p>
            <h2>Savings Bucket</h2>
          </div>
          <button type="button" className="ghost" onClick={onClose}>Close</button>
        </div>
        <div className="form-grid">
          <label>
            <span>Bucket Name</span>
            <input value={bucket.name} onChange={(event) => update("name", event.target.value)} required autoFocus />
          </label>
          <label>
            <span>Goal Amount</span>
            <input type="number" step="0.01" value={bucket.goalAmount} onChange={(event) => update("goalAmount", event.target.value)} />
          </label>
          <label>
            <span>Current Starting Balance</span>
            <input type="number" step="0.01" value={bucket.startingBalance} onChange={(event) => update("startingBalance", event.target.value)} />
          </label>
          <label>
            <span>Monthly Contribution</span>
            <input type="number" step="0.01" value={bucket.monthlyContribution} onChange={(event) => update("monthlyContribution", event.target.value)} />
          </label>
          <label>
            <span>Target Date</span>
            <input type="date" value={bucket.targetDate} onChange={(event) => update("targetDate", event.target.value)} />
          </label>
          <label>
            <span>Status</span>
            <select value={bucket.status} onChange={(event) => update("status", event.target.value)}>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
            </select>
          </label>
          <label className="wide-field">
            <span>Notes</span>
            <input value={bucket.notes} onChange={(event) => update("notes", event.target.value)} />
          </label>
        </div>
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary">Save Bucket</button>
        </div>
      </form>
    </div>
  );
}

function ImportsScreen({ budgetState }) {
  const { data, user, addRecord } = budgetState;
  const [imports, setImports] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [linkToken, setLinkToken] = useState(null);
  const [openWhenReady, setOpenWhenReady] = useState(false);
  const [edits, setEdits] = useState({});

  const categoryOptions = {
    expense: data.lists.categories,
    income: data.lists.incomeTypes,
    reimbursement: data.lists.incomeTypes,
    savings: data.lists.savingsPurposes,
    transfer: ["Other"],
    unknown: ["Other"],
  };

  async function loadImports() {
    if (!user) return;
    const [importResult, accountResult] = await Promise.all([
      supabase
        .from("budget_imported_transactions")
        .select("*")
        .order("date", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase.from("budget_plaid_accounts").select("*").order("created_at", { ascending: false }),
    ]);

    if (importResult.error) {
      setMessage(importResult.error.message);
      return;
    }
    if (accountResult.error) {
      setMessage(accountResult.error.message);
      return;
    }

    setImports(importResult.data || []);
    setAccounts(accountResult.data || []);
  }

  useEffect(() => {
    loadImports();
  }, [user?.id]);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: async (publicToken, metadata) => {
      setBusy(true);
      setMessage("Connecting bank account...");
      const { error } = await supabase.functions.invoke("budget-plaid-exchange-token", {
        body: {
          publicToken,
          institutionName: metadata?.institution?.name || "",
        },
      });
      if (error) {
        setMessage(error.message);
      } else {
        setMessage("Bank connected. Run Sync Transactions to import pending entries.");
        await loadImports();
      }
      setBusy(false);
    },
  });

  useEffect(() => {
    if (linkToken && ready && openWhenReady) {
      open();
      setOpenWhenReady(false);
    }
  }, [linkToken, ready, openWhenReady, open]);

  function getEdit(imported) {
    return {
      final_type: imported.final_type || imported.suggested_type || "expense",
      final_category: imported.final_category || imported.suggested_category || "Other",
      ...edits[imported.id],
    };
  }

  function updateEdit(id, changes) {
    setEdits((current) => ({ ...current, [id]: { ...(current[id] || {}), ...changes } }));
  }

  async function connectBank() {
    if (!user) {
      setMessage("Sign in before connecting a bank account.");
      return;
    }
    setBusy(true);
    setMessage("Preparing Plaid Link...");
    const { data: result, error } = await supabase.functions.invoke("budget-plaid-create-link-token", { body: {} });
    setBusy(false);

    if (error || !result?.link_token) {
      setMessage(error?.message || result?.error || "Unable to create Plaid Link token.");
      return;
    }

    setLinkToken(result.link_token);
    setOpenWhenReady(true);
    setMessage("Opening Plaid Link...");
  }

  async function syncTransactions() {
    setBusy(true);
    setMessage("Syncing transactions...");
    const { data: result, error } = await supabase.functions.invoke("budget-plaid-sync-transactions", { body: {} });
    if (error) {
      setMessage(error.message);
    } else {
      setMessage(result?.message || `Sync complete. Added ${result?.added || 0}, modified ${result?.modified || 0}, removed ${result?.removed || 0}.`);
      await loadImports();
    }
    setBusy(false);
  }

  async function rejectImport(imported) {
    setBusy(true);
    const { error } = await supabase.from("budget_imported_transactions").update({ approval_status: "rejected" }).eq("id", imported.id);
    setBusy(false);
    setMessage(error ? error.message : "Import rejected.");
    await loadImports();
  }

  async function approveImport(imported) {
    const edit = getEdit(imported);
    const record = importedToRecord(imported, edit);
    if (!record) {
      setMessage("Choose Expense, Income, Savings, or Reimbursement before approving.");
      return;
    }

    setBusy(true);
    addRecord(record.type, record.record);
    const { error } = await supabase
      .from("budget_imported_transactions")
      .update({
        approval_status: "approved",
        final_type: edit.final_type,
        final_category: edit.final_category,
        app_record_type: record.type,
        app_record_id: record.record.id,
      })
      .eq("id", imported.id);
    setBusy(false);

    setMessage(error ? error.message : "Import approved and added to your budget.");
    await loadImports();
  }

  if (!user) {
    return (
      <section className="panel account-panel">
        <div className="panel-title">
          <Upload size={18} />
          <h2>Imported Transactions</h2>
        </div>
        <p className="empty-text">Sign in before connecting a bank account or reviewing imported transactions.</p>
      </section>
    );
  }

  const pending = imports.filter((item) => item.approval_status === "pending");
  const reviewed = imports.filter((item) => item.approval_status !== "pending").slice(0, 12);

  return (
    <div className="page-stack">
      <section className="toolbar-band">
        <div>
          <p className="eyebrow">Plaid Sandbox</p>
          <h2>Imported Transactions</h2>
          {message && <p className="sync-line"><Cloud size={14} />{message}</p>}
        </div>
        <div className="management-actions">
          <button className="primary" onClick={connectBank} disabled={busy}>
            <Landmark size={17} />
            Connect Bank
          </button>
          <button className="icon-text" onClick={syncTransactions} disabled={busy || accounts.length === 0}>
            <Download size={17} />
            Sync Transactions
          </button>
        </div>
      </section>

      <section className="kpi-grid import-kpis">
        <Kpi label="Connected Accounts" value={accounts.length} icon={Landmark} tone="green" />
        <Kpi label="Pending Review" value={pending.length} icon={Upload} tone="amber" />
        <Kpi label="Approved Imports" value={imports.filter((item) => item.approval_status === "approved").length} icon={CircleDollarSign} tone="blue" />
        <Kpi label="Rejected Imports" value={imports.filter((item) => item.approval_status === "rejected").length} icon={Trash2} tone="rose" />
      </section>

      <Panel title="Pending Review" icon={Upload}>
        <ImportReviewTable
          imports={pending}
          categoryOptions={categoryOptions}
          getEdit={getEdit}
          updateEdit={updateEdit}
          onApprove={approveImport}
          onReject={rejectImport}
          busy={busy}
        />
      </Panel>

      <Panel title="Recently Reviewed" icon={CalendarDays}>
        <ReviewedImportsTable imports={reviewed} />
      </Panel>
    </div>
  );
}

function importedToRecord(imported, edit) {
  const common = {
    importSource: "plaid",
    plaidImportedTransactionId: imported.id,
    plaidTransactionId: imported.plaid_transaction_id,
    plaidAccountId: imported.plaid_account_id,
    merchantName: imported.merchant_name,
    accountName: imported.account_name,
  };
  const description = imported.merchant_name || imported.name || "Imported transaction";
  const amount = Math.abs(Number(imported.amount || 0));
  const idPrefix = edit.final_type === "income" || edit.final_type === "reimbursement" ? "inc" : edit.final_type === "savings" ? "sav" : "tx";

  if (edit.final_type === "income" || edit.final_type === "reimbursement") {
    return {
      type: "income",
      record: {
        ...common,
        id: createId(idPrefix),
        date: imported.date,
        source: imported.account_name || imported.merchant_name || "Plaid import",
        description,
        amount,
        incomeType: edit.final_type === "reimbursement" ? "Paid back by someone" : edit.final_category,
        notes: edit.final_type === "reimbursement" ? "Imported as reimbursement income. Link to the original expense if needed." : "",
      },
    };
  }

  if (edit.final_type === "savings") {
    return {
      type: "savings",
      record: {
        ...common,
        id: createId(idPrefix),
        date: imported.date,
        amount,
        location: imported.account_name || "Savings account",
        purpose: edit.final_category,
        bucketId: "",
        notes: description,
      },
    };
  }

  if (edit.final_type === "expense") {
    return {
      type: "transactions",
      record: {
        ...common,
        id: createId(idPrefix),
        date: imported.date,
        description,
        category: edit.final_category,
        amount,
        paymentMethod: imported.account_name || "Debit Card",
        paidForSomeone: false,
        personOwes: "",
        amountOwed: 0,
        amountPaidBack: 0,
        datePaidBack: "",
        reimbursementPaymentMethod: "",
        reimbursementNotes: "",
        savingsBucketId: "",
        bucketAmountUsed: 0,
      },
    };
  }

  return null;
}

function ImportReviewTable({ imports, categoryOptions, getEdit, updateEdit, onApprove, onReject, busy }) {
  if (imports.length === 0) return <p className="empty-text">No imported transactions are waiting for review.</p>;

  return (
    <div className="table-wrap import-table">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Merchant</th>
            <th>Account</th>
            <th>Amount</th>
            <th>Suggested</th>
            <th>Final Type</th>
            <th>Final Category</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {imports.map((imported) => {
            const edit = getEdit(imported);
            const options = categoryOptions[edit.final_type] || ["Other"];
            return (
              <tr key={imported.id}>
                <td>{toShortDate(imported.date)}</td>
                <td>
                  <strong>{imported.merchant_name || imported.name}</strong>
                  <span className="cell-subtext">{imported.plaid_category_primary || "Uncategorized"}</span>
                </td>
                <td>{imported.account_name || imported.plaid_account_id}</td>
                <td>{toCurrency(imported.amount)}</td>
                <td>
                  <span className="status not-reimbursable">{imported.suggested_type}</span>
                  <span className="cell-subtext">{imported.suggested_category}</span>
                </td>
                <td>
                  <select
                    value={edit.final_type}
                    onChange={(event) => updateEdit(imported.id, { final_type: event.target.value, final_category: (categoryOptions[event.target.value] || ["Other"])[0] })}
                  >
                    {["expense", "income", "reimbursement", "savings", "transfer", "unknown"].map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </td>
                <td>
                  <select value={edit.final_category} onChange={(event) => updateEdit(imported.id, { final_category: event.target.value })}>
                    {options.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </td>
                <td>
                  <div className="row-actions">
                    <button className="primary" onClick={() => onApprove(imported)} disabled={busy || ["transfer", "unknown"].includes(edit.final_type)}>Approve</button>
                    <button className="danger" onClick={() => onReject(imported)} disabled={busy}>Reject</button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ReviewedImportsTable({ imports }) {
  if (imports.length === 0) return <p className="empty-text">Approved and rejected imports will show here.</p>;

  return (
    <div className="table-wrap compact-table">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Merchant</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Added As</th>
          </tr>
        </thead>
        <tbody>
          {imports.map((item) => (
            <tr key={item.id}>
              <td>{toShortDate(item.date)}</td>
              <td>{item.merchant_name || item.name}</td>
              <td>{toCurrency(item.amount)}</td>
              <td><span className={`status ${item.approval_status === "approved" ? "paid" : "not-paid"}`}>{item.approval_status}</span></td>
              <td>{item.app_record_type || item.final_type || item.suggested_type}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Summaries({ data, budget, selectedMonth }) {
  const years = useMemo(() => getAvailableYears(data), [data]);
  const [selectedYear, setSelectedYear] = useState(() => selectedMonth.slice(0, 4));
  const yearRows = useMemo(() => getYearlySpendingSummary(data, selectedYear), [data, selectedYear]);
  const yearTotal = yearRows.reduce((total, row) => total + row.spending, 0);
  const yearGross = yearRows.reduce((total, row) => total + row.gross, 0);
  const yearReimbursed = yearRows.reduce((total, row) => total + row.reimbursed, 0);
  const yearBucketUsed = yearRows.reduce((total, row) => total + row.bucketUsed, 0);

  useEffect(() => {
    if (!years.includes(selectedYear)) setSelectedYear(selectedMonth.slice(0, 4));
  }, [selectedMonth, selectedYear, years]);

  return (
    <div className="page-stack">
      <section className="toolbar-band">
        <div>
          <p className="eyebrow">Year View</p>
          <h2>Spending By Month</h2>
        </div>
        <select value={selectedYear} onChange={(event) => setSelectedYear(event.target.value)} aria-label="Selected year">
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </section>

      <section className="kpi-grid year-kpis">
        <Kpi label="Net Spending" value={toCurrency(yearTotal)} icon={WalletCards} tone="blue" />
        <Kpi label="Gross Spending" value={toCurrency(yearGross)} icon={CircleDollarSign} tone="amber" />
        <Kpi label="Paid Back" value={toCurrency(yearReimbursed)} icon={HandCoins} tone="green" />
        <Kpi label="From Buckets" value={toCurrency(yearBucketUsed)} icon={Landmark} tone="purple" />
      </section>

      <Panel title={`${selectedYear} Monthly Spending`} icon={BarChart3}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Month</th>
                <th>Gross Spending</th>
                <th>Paid Back</th>
                <th>From Buckets</th>
                <th>Net Spending</th>
                {data.lists.categories.map((category) => <th key={category}>{category}</th>)}
              </tr>
            </thead>
            <tbody>
              {yearRows.map((row) => (
                <tr key={row.month}>
                  <td>{row.label}</td>
                  <td>{toCurrency(row.gross)}</td>
                  <td>{toCurrency(row.reimbursed)}</td>
                  <td>{toCurrency(row.bucketUsed)}</td>
                  <td>{toCurrency(row.spending)}</td>
                  {data.lists.categories.map((category) => <td key={category}>{toCurrency(row.categories[category])}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Weekly Summary" icon={CalendarDays}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Week</th>
                <th>Spending</th>
                <th>Income</th>
                <th>Savings</th>
                <th>Leftover</th>
              </tr>
            </thead>
            <tbody>
              {budget.weekly.map((row) => (
                <tr key={row.weekStart}>
                  <td>{toShortDate(row.weekStart)}</td>
                  <td>{toCurrency(row.spending)}</td>
                  <td>{toCurrency(row.income)}</td>
                  <td>{toCurrency(row.savings)}</td>
                  <td className={row.net < 0 ? "negative" : "positive"}>{toCurrency(row.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel title="Monthly Summary" icon={LineChart}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Month</th>
                <th>Spending</th>
                <th>Income</th>
                <th>Savings</th>
                <th>Leftover</th>
                {data.lists.categories.map((category) => <th key={category}>{category}</th>)}
              </tr>
            </thead>
            <tbody>
              {budget.monthly.map((row) => (
                <tr key={row.month}>
                  <td>{row.label}</td>
                  <td>{toCurrency(row.spending)}</td>
                  <td>{toCurrency(row.income)}</td>
                  <td>{toCurrency(row.savings)}</td>
                  <td className={row.net < 0 ? "negative" : "positive"}>{toCurrency(row.net)}</td>
                  {data.lists.categories.map((category) => <td key={category}>{toCurrency(row.categories[category])}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function HouseholdScreen({ budgetState, selectedMonth }) {
  const {
    user,
    households,
    activeHouseholdId,
    setActiveHouseholdId,
    householdMembers,
    householdProfiles,
    householdStatus,
  } = budgetState;

  const memberNameById = useMemo(() => {
    return Object.fromEntries(
      householdMembers.map((member) => [member.user_id, member.display_name || (member.user_id === user?.id ? user.email : "Household member")]),
    );
  }, [householdMembers, user?.email, user?.id]);

  const mergedData = useMemo(() => mergeBudgetData(householdProfiles), [householdProfiles]);
  const householdBudget = useMemo(() => calculateHouseholdBudget(mergedData, selectedMonth), [mergedData, selectedMonth]);
  const activeHousehold = households.find((household) => household.id === activeHouseholdId);

  if (!user) {
    return (
      <section className="panel account-panel">
        <div className="panel-title">
          <UsersRound size={18} />
          <h2>Household</h2>
        </div>
        <p className="empty-text">Sign in from the Account tab to connect multiple household budgets.</p>
      </section>
    );
  }

  if (households.length === 0) {
    return (
      <section className="panel account-panel">
        <div className="panel-title">
          <UsersRound size={18} />
          <h2>Household</h2>
        </div>
        <p className="empty-text">Create or join a household from the Account tab, then this page will show shared totals.</p>
      </section>
    );
  }

  return (
    <div className="page-stack">
      <section className="toolbar-band">
        <div>
          <p className="eyebrow">Connected Household</p>
          <h2>{activeHousehold?.name || "Household"}</h2>
          <p className="sync-line">
            <Cloud size={14} />
            {householdStatus}
          </p>
        </div>
        <select value={activeHouseholdId} onChange={(event) => setActiveHouseholdId(event.target.value)} aria-label="Household">
          {households.map((household) => (
            <option key={household.id} value={household.id}>
              {household.name}
            </option>
          ))}
        </select>
      </section>

      <section className="kpi-grid household-kpis">
        <Kpi label="Household Income" value={toCurrency(householdBudget.incomeTotal)} icon={CircleDollarSign} tone="green" />
        <Kpi label="Household Spending" value={toCurrency(householdBudget.spendingTotal)} icon={WalletCards} tone="blue" />
        <Kpi label="Household Saved" value={toCurrency(householdBudget.savingsTotal)} icon={PiggyBank} tone="amber" />
        <Kpi label="Leftover" value={toCurrency(householdBudget.leftover)} icon={Landmark} tone={householdBudget.leftover >= 0 ? "green" : "rose"} />
      </section>

      <section className="dashboard-grid">
        <Panel title="By Person" icon={UsersRound}>
          <div className="table-wrap compact-table">
            <table>
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Income</th>
                  <th>Spending</th>
                  <th>Savings</th>
                  <th>Leftover</th>
                </tr>
              </thead>
              <tbody>
                {householdBudget.byPerson.map((row) => (
                  <tr key={row.userId}>
                    <td>{memberNameById[row.userId] || "Household member"}</td>
                    <td>{toCurrency(row.income)}</td>
                    <td>{toCurrency(row.spending)}</td>
                    <td>{toCurrency(row.savings)}</td>
                    <td className={row.leftover < 0 ? "negative" : "positive"}>{toCurrency(row.leftover)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Spending By Category" icon={BarChart3}>
          <div className="progress-list">
            {householdBudget.categorySpending.slice(0, 8).map((item) => (
              <ProgressRow key={item.name} label={item.name} spent={item.amount} budget={householdBudget.spendingTotal || 1} />
            ))}
            {householdBudget.categorySpending.length === 0 && <p className="empty-text">No household spending entered for this month.</p>}
          </div>
        </Panel>
      </section>

      <Panel title="Household Activity" icon={CalendarDays}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Person</th>
                <th>Type</th>
                <th>Description</th>
                <th>Category / Source</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {householdBudget.activity.map((item) => (
                <tr key={`${item.type}-${item.id}-${item.ownerUserId}`}>
                  <td>{toShortDate(item.date)}</td>
                  <td>{memberNameById[item.ownerUserId] || "Household member"}</td>
                  <td>{item.typeLabel}</td>
                  <td>{item.description}</td>
                  <td>{item.detail}</td>
                  <td className={item.type === "income" ? "positive" : ""}>{toCurrency(item.amount)}</td>
                </tr>
              ))}
              {householdBudget.activity.length === 0 && (
                <tr>
                  <td colSpan="6">No household activity entered for {monthLabel(selectedMonth)}.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function calculateHouseholdBudget(data, selectedMonth) {
  const budget = calculateBudget(data, selectedMonth);
  const memberIds = Array.from(
    new Set([
      ...data.transactions.map((item) => item.ownerUserId),
      ...data.income.map((item) => item.ownerUserId),
      ...data.savings.map((item) => item.ownerUserId),
    ].filter(Boolean)),
  );

  const byPerson = memberIds.map((userId) => {
    const spending = data.transactions.filter((item) => item.ownerUserId === userId && item.date?.startsWith(selectedMonth)).reduce((sum, item) => sum + getTransactionBudgetAmount(item), 0);
    const income = data.income.filter((item) => item.ownerUserId === userId && item.date?.startsWith(selectedMonth)).reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const savings = data.savings.filter((item) => item.ownerUserId === userId && item.date?.startsWith(selectedMonth)).reduce((sum, item) => sum + Number(item.amount || 0), 0);
    return { userId, income, spending, savings, leftover: income - spending - savings };
  });

  const activity = [
    ...budget.monthlyTransactions.map((item) => ({
      ...item,
      type: "spending",
      typeLabel: "Spending",
      date: item.date,
      detail: item.category,
      description: item.description,
      amount: getTransactionBudgetAmount(item),
    })),
    ...budget.monthlyIncome.map((item) => ({
      ...item,
      type: "income",
      typeLabel: "Income",
      date: item.date,
      detail: item.source || item.incomeType,
      description: item.description || item.source,
    })),
    ...budget.monthlySavings.map((item) => ({
      ...item,
      type: "savings",
      typeLabel: "Savings",
      date: item.date,
      detail: item.location,
      description: item.purpose,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  return {
    ...budget,
    byPerson,
    categorySpending: budget.categorySpending.filter((item) => item.amount > 0).sort((a, b) => b.amount - a.amount),
    activity,
  };
}

function SettingsScreen({ budgetState, importInputRef, onExport, onImportClick, onImportFile, installPrompt, onInstall, onOpenImports }) {
  const { data, addListItem, removeListItem, resetData, updateCategoryBudget, updateTarget } = budgetState;
  const listLabels = {
    categories: "Categories",
    paymentMethods: "Payment Methods",
    incomeTypes: "Income Types",
    savingsLocations: "Savings Locations",
    savingsPurposes: "Savings Purposes",
  };
  return (
    <div className="settings-grid">
      <section className="panel settings-wide management-panel">
        <div className="panel-title">
          <Settings size={18} />
          <h2>App & Data</h2>
        </div>
        <div className="management-actions">
          <button className="icon-text" onClick={onExport} title="Export data">
            <Download size={17} />
            Export Backup
          </button>
          <button className="icon-text" onClick={onImportClick} title="Import backup">
            <Upload size={17} />
            Import Backup
          </button>
          <button className="icon-text" onClick={onOpenImports} title="Connect bank">
            <Landmark size={17} />
            Connect Bank
          </button>
          <input ref={importInputRef} className="file-input" type="file" accept="application/json,.json" onChange={onImportFile} />
          {installPrompt && (
            <button className="icon-text" onClick={onInstall} title="Install app">
              <Smartphone size={17} />
              Install App
            </button>
          )}
        </div>
      </section>
      <TargetEditor data={data} updateTarget={updateTarget} updateCategoryBudget={updateCategoryBudget} />
      {Object.entries(listLabels).map(([key, label]) => (
        <ListEditor
          key={key}
          title={label}
          items={data.lists[key]}
          onAdd={(value) => addListItem(key, value)}
          onRemove={(value) => removeListItem(key, value)}
        />
      ))}
      <section className="panel settings-wide danger-zone">
        <div className="panel-title">
          <RotateCcw size={18} />
          <h2>Reset Budget</h2>
        </div>
        <p className="empty-text">
          This clears all spending, income, savings, reimbursements, and budget target amounts. Your category and list settings stay in place.
          Savings bucket names stay in place, but their balances, goals, and monthly contributions are set to zero.
        </p>
        <button
          className="icon-text danger-action"
          onClick={() => {
            const confirmed = window.confirm(
              "Are you sure you want to reset your budget? This will clear all money entries and set budget targets to zero.",
            );
            if (confirmed) resetData();
          }}
        >
          <RotateCcw size={17} />
          Reset All Money To Zero
        </button>
      </section>
    </div>
  );
}

function AccountScreen({ budgetState }) {
  const {
    user,
    authLoading,
    syncStatus,
    households,
    activeHouseholdId,
    setActiveHouseholdId,
    householdMembers,
    householdStatus,
    signIn,
    signOut,
    signUp,
    createHousehold,
    joinHousehold,
    leaveHousehold,
  } = budgetState;
  const [mode, setMode] = useState("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [householdName, setHouseholdName] = useState("My Household");
  const [displayName, setDisplayName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const activeHousehold = households.find((household) => household.id === activeHouseholdId);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const result = mode === "signUp" ? await signUp(email, password) : await signIn(email, password);
    setMessage(result.error ? result.error.message : mode === "signUp" ? "Check your email to confirm your account." : "Signed in.");
    setBusy(false);
  }

  if (authLoading) {
    return (
      <section className="panel account-panel">
        <p className="empty-text">Checking account...</p>
      </section>
    );
  }

  if (user) {
    return (
      <div className="settings-grid">
        <section className="panel account-panel">
          <div className="panel-title">
            <UserRound size={18} />
            <h2>Your Account</h2>
          </div>
          <div className="account-card">
            <span>Signed in as</span>
            <strong>{user.email}</strong>
            <p>
              <Cloud size={16} />
              {syncStatus}
            </p>
          </div>
          <p className="empty-text">
            Your budget syncs to Supabase under your account. Household members can read your budget for the shared Household tab after you connect accounts.
          </p>
          <button className="secondary" onClick={signOut}>
            Sign Out
          </button>
        </section>

        <section className="panel account-panel">
          <div className="panel-title">
            <UsersRound size={18} />
            <h2>Household Accounts</h2>
          </div>
          <p className="sync-line">
            <Cloud size={14} />
            {householdStatus}
          </p>

          {households.length > 0 && (
            <div className="household-stack">
              <label>
                <span>Current Household</span>
                <select value={activeHouseholdId} onChange={(event) => setActiveHouseholdId(event.target.value)}>
                  {households.map((household) => (
                    <option key={household.id} value={household.id}>
                      {household.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="account-card">
                <span>Household code</span>
                <strong className="code-text">{activeHouseholdId}</strong>
                <button className="icon-text" onClick={() => navigator.clipboard?.writeText(activeHouseholdId)} title="Copy household code">
                  <Copy size={16} />
                  Copy Code
                </button>
              </div>
              <div className="mini-list">
                {householdMembers.map((member) => (
                  <div className="mini-row" key={member.user_id}>
                    <div>
                      <strong>{member.display_name || (member.user_id === user.id ? user.email : "Household member")}</strong>
                      <span>{member.role === "owner" ? "Owner" : "Member"}</span>
                    </div>
                  </div>
                ))}
              </div>
              <button className="secondary" onClick={() => leaveHousehold(activeHouseholdId)}>
                Leave Household
              </button>
            </div>
          )}

          <div className="household-forms">
            <form className="account-form" onSubmit={async (event) => {
              event.preventDefault();
              setBusy(true);
              const result = await createHousehold(householdName, displayName);
              setMessage(result.error ? result.error.message : "Household created.");
              setBusy(false);
            }}>
              <h3>Create Household</h3>
              <label>
                <span>Household Name</span>
                <input value={householdName} onChange={(event) => setHouseholdName(event.target.value)} required />
              </label>
              <label>
                <span>Your Display Name</span>
                <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder={user.email} />
              </label>
              <button className="primary" type="submit" disabled={busy}>
                Create Household
              </button>
            </form>

            <form className="account-form" onSubmit={async (event) => {
              event.preventDefault();
              setBusy(true);
              const result = await joinHousehold(joinCode, displayName);
              setMessage(result.error ? result.error.message : "Household joined.");
              setBusy(false);
            }}>
              <h3>Join Household</h3>
              <label>
                <span>Household Code</span>
                <input value={joinCode} onChange={(event) => setJoinCode(event.target.value)} placeholder="Paste household code" required />
              </label>
              <label>
                <span>Your Display Name</span>
                <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder={user.email} />
              </label>
              <button className="secondary" type="submit" disabled={busy}>
                Join Household
              </button>
            </form>
          </div>
          {activeHousehold && <p className="empty-text">Open the Household tab to see shared totals for {activeHousehold.name}.</p>}
          {message && <p className="account-message">{message}</p>}
        </section>
      </div>
    );
  }

  return (
    <section className="panel account-panel">
      <div className="panel-title">
        <UserRound size={18} />
        <h2>{mode === "signUp" ? "Create Account" : "Sign In"}</h2>
      </div>
      <div className="segmented account-segment">
        <button type="button" className={mode === "signIn" ? "active" : ""} onClick={() => setMode("signIn")}>
          Sign In
        </button>
        <button type="button" className={mode === "signUp" ? "active" : ""} onClick={() => setMode("signUp")}>
          Create Account
        </button>
      </div>
      <form className="account-form" onSubmit={submit}>
        <label>
          <span>Email</span>
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label>
          <span>Password</span>
          <input
            type="password"
            minLength="6"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        <button className="primary" type="submit" disabled={busy}>
          {busy ? "Working..." : mode === "signUp" ? "Create Account" : "Sign In"}
        </button>
      </form>
      {message && <p className="account-message">{message}</p>}
      <p className="empty-text">
        If email confirmation is enabled in Supabase, new accounts must confirm by email before signing in.
      </p>
    </section>
  );
}

function TargetEditor({ data, updateTarget, updateCategoryBudget }) {
  return (
    <section className="panel settings-wide">
      <div className="panel-title">
        <Target size={18} />
        <h2>Targets</h2>
      </div>
      <div className="target-grid">
        <label>
          <span>Monthly Savings Goal</span>
          <input
            type="number"
            min="0"
            step="1"
            value={data.targets?.monthlySavingsGoal || 0}
            onChange={(event) => updateTarget("monthlySavingsGoal", Number(event.target.value || 0))}
          />
        </label>
        {data.lists.categories.map((category) => (
          <label key={category}>
            <span>{category} Budget</span>
            <input
              type="number"
              min="0"
              step="1"
              value={data.targets?.categoryBudgets?.[category] || 0}
              onChange={(event) => updateCategoryBudget(category, event.target.value)}
            />
          </label>
        ))}
      </div>
    </section>
  );
}

function ListEditor({ title, items, onAdd, onRemove }) {
  const [value, setValue] = useState("");
  return (
    <section className="panel">
      <div className="panel-title">
        <Settings size={18} />
        <h2>{title}</h2>
      </div>
      <form className="inline-form" onSubmit={(event) => {
        event.preventDefault();
        onAdd(value);
        setValue("");
      }}>
        <input value={value} onChange={(event) => setValue(event.target.value)} placeholder="Add item" />
        <button className="primary" type="submit">Add</button>
      </form>
      <div className="chip-list">
        {items.map((item) => (
          <span className="chip" key={item}>
            {item}
            <button onClick={() => onRemove(item)} title={`Remove ${item}`}>×</button>
          </span>
        ))}
      </div>
    </section>
  );
}

const rootElement = document.getElementById("root");
window.__budgetAppRoot = window.__budgetAppRoot || createRoot(rootElement);
window.__budgetAppRoot.render(<App />);
