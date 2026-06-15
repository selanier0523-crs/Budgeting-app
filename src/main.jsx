import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BarChart3,
  CalendarDays,
  Cloud,
  CircleDollarSign,
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
  WalletCards,
} from "lucide-react";
import { useBudget } from "./lib/useBudget";
import {
  downloadJson,
  getReimbursementComputed,
  monthLabel,
  toCurrency,
  toShortDate,
  todayISO,
} from "./lib/budgetData";
import "./styles.css";

const tabs = [
  { id: "dashboard", label: "Dashboard", icon: Home },
  { id: "transactions", label: "Spending", icon: WalletCards },
  { id: "income", label: "Income", icon: CircleDollarSign },
  { id: "savings", label: "Savings", icon: PiggyBank },
  { id: "reimbursements", label: "Owed To Me", icon: HandCoins },
  { id: "summaries", label: "Summaries", icon: LineChart },
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
  const { data, user, syncStatus, selectedMonth, setSelectedMonth, months, budget, addRecord, importData, resetData } = budgetState;
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
            <select value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} aria-label="Selected month">
              {months.map((month) => (
                <option key={month} value={month}>
                  {monthLabel(month)}
                </option>
              ))}
            </select>
            <button className="icon-text" onClick={() => downloadJson(data)} title="Export data">
              <Download size={17} />
              Export
            </button>
            <button className="icon-text" onClick={() => importInputRef.current?.click()} title="Import backup">
              <Upload size={17} />
              Import
            </button>
            <input ref={importInputRef} className="file-input" type="file" accept="application/json,.json" onChange={handleImportFile} />
            {installPrompt && (
              <button className="icon-text" onClick={installApp} title="Install app">
                <Smartphone size={17} />
                Install
              </button>
            )}
            <button className="icon-text danger-light" onClick={resetData} title="Reset example data">
              <RotateCcw size={17} />
              Reset
            </button>
          </div>
        </header>

        {activeTab === "dashboard" && <Dashboard data={data} budget={budget} selectedMonth={selectedMonth} />}
        {activeTab === "transactions" && <RecordScreen title="Spending" type="transactions" budgetState={budgetState} />}
        {activeTab === "income" && <RecordScreen title="Income" type="income" budgetState={budgetState} />}
        {activeTab === "savings" && <RecordScreen title="Savings" type="savings" budgetState={budgetState} />}
        {activeTab === "reimbursements" && <RecordScreen title="Owed To Me" type="reimbursements" budgetState={budgetState} />}
        {activeTab === "summaries" && <Summaries data={data} budget={budget} />}
        {activeTab === "settings" && <SettingsScreen budgetState={budgetState} />}
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
  const openReimbursements = data.reimbursements.filter((item) => getReimbursementComputed(item).stillOwed > 0);

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
                <ProgressRow key={item.name} label={item.name} spent={item.spent} budget={item.budget} remaining={item.remaining} />
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
                <b>{toCurrency(item.amount)}</b>
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

function ProgressRow({ label, spent, budget, remaining, kind = "spending" }) {
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

function RecordScreen({ title, type, budgetState }) {
  const { data, addRecord, updateRecord, deleteRecord, duplicateRecord } = budgetState;
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null);
  const rows = data[type];
  const filteredRows = useMemo(() => {
    const text = query.toLowerCase();
    return rows.filter((item) => JSON.stringify(item).toLowerCase().includes(text));
  }, [rows, query]);

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
          onEdit={setEditing}
          onDelete={(id) => deleteRecord(type, id)}
          onDuplicate={(record) => duplicateRecord(type, record)}
        />
      </section>

      {editing && (
        <RecordModal
          type={type}
          lists={data.lists}
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

function EditableTable({ type, rows, lists, onEdit, onDelete, onDuplicate }) {
  if (rows.length === 0) return <p className="empty-text">No records found.</p>;
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
            return (
              <tr key={row.id}>
                {columns.map((column) => (
                  <td key={column.key}>{formatCell(row, column, computed, lists)}</td>
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
      { key: "paymentMethod", label: "Payment" },
      { key: "paidForSomeone", label: "For Someone?", kind: "boolean" },
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

function formatCell(row, column, computed) {
  if (column.kind === "money") return toCurrency(row[column.key]);
  if (column.kind === "computedMoney") return toCurrency(computed.stillOwed);
  if (column.kind === "date") return row[column.key] ? toShortDate(row[column.key]) : "";
  if (column.kind === "boolean") return row[column.key] ? "Yes" : "No";
  if (column.kind === "status") return <span className={`status ${computed.status.toLowerCase().replace(/\s+/g, "-")}`}>{computed.status}</span>;
  return row[column.key] || "";
}

function QuickAdd({ data, onClose, onAdd }) {
  const [type, setType] = useState("transactions");
  return (
    <RecordModal
      type={type}
      lists={data.lists}
      initial={{}}
      quickAdd
      onClose={onClose}
      onTypeChange={setType}
      onSave={(record) => onAdd(type, record)}
    />
  );
}

function RecordModal({ type, lists, initial, onClose, onSave, quickAdd = false, onTypeChange }) {
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
        <div className="form-grid">{fieldsForType(type, lists).map((field) => (
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
      reimbursementNotes: "",
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
  if (type === "reimbursements") {
    next.amountPaid = Number(next.amountPaid || 0);
    next.amountPaidBack = Number(next.amountPaidBack || 0);
  }
  return next;
}

function fieldsForType(type, lists) {
  const fields = {
    transactions: [
      { key: "amount", label: "Amount", type: "number", required: true },
      { key: "description", label: "Description", required: true },
      { key: "category", label: "Category", type: "select", options: lists.categories },
      { key: "date", label: "Date", type: "date" },
      { key: "paymentMethod", label: "Payment Method", type: "select", options: lists.paymentMethods },
      { key: "paidForSomeone", label: "Paid For Someone", type: "checkbox" },
      { key: "reimbursementNotes", label: "Reimbursement Notes" },
    ],
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
          {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
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

function Summaries({ data, budget }) {
  return (
    <div className="page-stack">
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

function SettingsScreen({ budgetState }) {
  const { data, addListItem, removeListItem, updateCategoryBudget, updateTarget } = budgetState;
  const listLabels = {
    categories: "Categories",
    paymentMethods: "Payment Methods",
    incomeTypes: "Income Types",
    savingsLocations: "Savings Locations",
    savingsPurposes: "Savings Purposes",
  };
  return (
    <div className="settings-grid">
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
    </div>
  );
}

function AccountScreen({ budgetState }) {
  const { user, authLoading, syncStatus, signIn, signOut, signUp } = budgetState;
  const [mode, setMode] = useState("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

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
          Your budget now syncs to Supabase under your account. Local browser storage still keeps a copy for quick loading.
        </p>
        <button className="secondary" onClick={signOut}>
          Sign Out
        </button>
      </section>
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
