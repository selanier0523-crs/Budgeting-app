const STORAGE_KEY = "personal-budget-tracker:v1";

export const defaultLists = {
  categories: [
    "Food",
    "Clothes",
    "Necessities",
    "Gifts",
    "Gas/Transportation",
    "Entertainment",
    "Subscriptions",
    "School",
    "Other",
  ],
  paymentMethods: ["Debit Card", "Credit Card", "Cash", "Venmo", "Apple Pay", "Other"],
  incomeTypes: ["Paycheck", "Side job", "Gift", "Refund", "Paid back by someone", "Other"],
  savingsLocations: [
    "Savings account",
    "Checking buffer",
    "Cash",
    "Emergency fund",
    "Vacation fund",
    "School fund",
    "Other",
  ],
  savingsPurposes: ["General savings", "Emergency", "Travel", "School", "Big purchase", "Future bills", "Other"],
};

export const defaultTargets = {
  monthlySavingsGoal: 250,
  categoryBudgets: {
    Food: 300,
    Clothes: 100,
    Necessities: 150,
    Gifts: 75,
    "Gas/Transportation": 175,
    Entertainment: 125,
    Subscriptions: 75,
    School: 100,
    Other: 100,
  },
};

export const seedData = {
  lists: defaultLists,
  targets: defaultTargets,
  transactions: [
    {
      id: "tx-1",
      date: "2026-06-01",
      description: "Example groceries",
      category: "Food",
      amount: 54.32,
      paymentMethod: "Credit Card",
      paidForSomeone: false,
      reimbursementNotes: "",
    },
    {
      id: "tx-2",
      date: "2026-06-02",
      description: "Example gas",
      category: "Gas/Transportation",
      amount: 38.5,
      paymentMethod: "Debit Card",
      paidForSomeone: false,
      reimbursementNotes: "",
    },
    {
      id: "tx-3",
      date: "2026-06-04",
      description: "Dinner paid for friend",
      category: "Food",
      amount: 24,
      paymentMethod: "Credit Card",
      paidForSomeone: true,
      reimbursementNotes: "Alex",
    },
  ],
  income: [
    {
      id: "inc-1",
      date: "2026-06-06",
      source: "Work",
      description: "Example paycheck",
      amount: 640,
      incomeType: "Paycheck",
      notes: "",
    },
    {
      id: "inc-2",
      date: "2026-06-08",
      source: "Alex",
      description: "Paid back for dinner",
      amount: 24,
      incomeType: "Paid back by someone",
      notes: "",
    },
  ],
  savings: [
    {
      id: "sav-1",
      date: "2026-06-08",
      amount: 150,
      location: "Savings account",
      purpose: "General savings",
      notes: "Moved money after paycheck",
    },
    {
      id: "sav-2",
      date: "2026-06-12",
      amount: 40,
      location: "Cash",
      purpose: "Travel",
      notes: "",
    },
  ],
  reimbursements: [
    {
      id: "reb-1",
      datePaid: "2026-06-04",
      person: "Alex",
      description: "Dinner",
      amountPaid: 24,
      amountPaidBack: 24,
      datePaidBack: "2026-06-08",
    },
    {
      id: "reb-2",
      datePaid: "2026-06-10",
      person: "Jordan",
      description: "Gift split",
      amountPaid: 30,
      amountPaidBack: 0,
      datePaidBack: "",
    },
  ],
};

export function createId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function loadBudgetData() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return seedData;
    const parsed = JSON.parse(stored);
    const categoryBudgets = {
      ...defaultTargets.categoryBudgets,
      ...(parsed.targets?.categoryBudgets || {}),
    };
    return {
      ...seedData,
      ...parsed,
      lists: { ...defaultLists, ...(parsed.lists || {}) },
      targets: {
        ...defaultTargets,
        ...(parsed.targets || {}),
        categoryBudgets,
      },
    };
  } catch {
    return seedData;
  }
}

export function saveBudgetData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function normalizeBudgetData(data) {
  const parsed = data && typeof data === "object" ? data : {};
  const lists = { ...defaultLists, ...(parsed.lists || {}) };
  const categoryBudgets = {
    ...defaultTargets.categoryBudgets,
    ...(parsed.targets?.categoryBudgets || {}),
  };
  return {
    ...seedData,
    ...parsed,
    transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
    income: Array.isArray(parsed.income) ? parsed.income : [],
    savings: Array.isArray(parsed.savings) ? parsed.savings : [],
    reimbursements: Array.isArray(parsed.reimbursements) ? parsed.reimbursements : [],
    lists,
    targets: {
      ...defaultTargets,
      ...(parsed.targets || {}),
      categoryBudgets,
    },
  };
}

export function resetBudgetData() {
  localStorage.removeItem(STORAGE_KEY);
  return seedData;
}

export function toCurrency(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value || 0));
}

export function toShortDate(dateString) {
  if (!dateString) return "";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(parseLocalDate(dateString));
}

export function monthKey(dateString) {
  if (!dateString) return "";
  return dateString.slice(0, 7);
}

export function monthLabel(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date(year, monthNumber - 1, 1));
}

export function parseLocalDate(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function todayISO() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export function sum(items, selector = (item) => item.amount) {
  return items.reduce((total, item) => total + Number(selector(item) || 0), 0);
}

export function inMonth(item, month, field = "date") {
  return monthKey(item[field]) === month;
}

export function getReimbursementComputed(item) {
  const stillOwed = Math.max(Number(item.amountPaid || 0) - Number(item.amountPaidBack || 0), 0);
  const status = stillOwed === 0 ? "Paid" : Number(item.amountPaidBack || 0) === 0 ? "Unpaid" : "Partially Paid";
  return { stillOwed, status };
}

export function getWeekStart(dateString) {
  const date = parseLocalDate(dateString);
  const day = date.getDay();
  date.setDate(date.getDate() - day);
  return date.toISOString().slice(0, 10);
}

export function groupBy(items, keyFn) {
  return items.reduce((groups, item) => {
    const key = keyFn(item);
    groups[key] = groups[key] || [];
    groups[key].push(item);
    return groups;
  }, {});
}

export function getAvailableMonths(data) {
  const months = new Set([
    ...data.transactions.map((item) => monthKey(item.date)),
    ...data.income.map((item) => monthKey(item.date)),
    ...data.savings.map((item) => monthKey(item.date)),
    ...data.reimbursements.map((item) => monthKey(item.datePaid)),
    todayISO().slice(0, 7),
  ].filter(Boolean));
  return Array.from(months).sort().reverse();
}

export function calculateBudget(data, selectedMonth) {
  const monthlyTransactions = data.transactions.filter((item) => inMonth(item, selectedMonth));
  const monthlyIncome = data.income.filter((item) => inMonth(item, selectedMonth));
  const monthlySavings = data.savings.filter((item) => inMonth(item, selectedMonth));

  const incomeTotal = sum(monthlyIncome);
  const spendingTotal = sum(monthlyTransactions);
  const savingsTotal = sum(monthlySavings);
  const owedTotal = sum(data.reimbursements, (item) => getReimbursementComputed(item).stillOwed);
  const leftover = incomeTotal - spendingTotal - savingsTotal;

  const categorySpending = data.lists.categories.map((category) => ({
    name: category,
    amount: sum(monthlyTransactions.filter((item) => item.category === category)),
  }));

  const savingsByLocation = data.lists.savingsLocations.map((location) => ({
    name: location,
    amount: sum(monthlySavings.filter((item) => item.location === location)),
  }));

  const savingsByPurpose = data.lists.savingsPurposes.map((purpose) => ({
    name: purpose,
    amount: sum(monthlySavings.filter((item) => item.purpose === purpose)),
  }));

  const categoryBudgets = data.lists.categories.map((category) => {
    const spent = sum(monthlyTransactions.filter((item) => item.category === category));
    const budget = Number(data.targets?.categoryBudgets?.[category] || 0);
    return {
      name: category,
      spent,
      budget,
      remaining: budget - spent,
      percent: budget > 0 ? Math.round((spent / budget) * 100) : 0,
    };
  });

  const savingsGoal = Number(data.targets?.monthlySavingsGoal || 0);
  const savingsProgress = {
    goal: savingsGoal,
    saved: savingsTotal,
    remaining: savingsGoal - savingsTotal,
    percent: savingsGoal > 0 ? Math.round((savingsTotal / savingsGoal) * 100) : 0,
  };

  const topCategory = [...categorySpending].sort((a, b) => b.amount - a.amount)[0] || { name: "None", amount: 0 };
  const overBudgetCategories = categoryBudgets.filter((item) => item.budget > 0 && item.spent > item.budget);
  const insights = [
    topCategory.amount > 0 ? `${topCategory.name} is your biggest spending category this month at ${toCurrency(topCategory.amount)}.` : "No spending has been entered for this month yet.",
    savingsGoal > 0
      ? savingsTotal >= savingsGoal
        ? `You have met your monthly savings goal by ${toCurrency(savingsTotal - savingsGoal)}.`
        : `You need ${toCurrency(savingsGoal - savingsTotal)} more to hit your savings goal.`
      : "Set a monthly savings goal in Settings to track saving progress.",
    overBudgetCategories.length > 0
      ? `${overBudgetCategories.length} category ${overBudgetCategories.length === 1 ? "is" : "are"} over budget.`
      : "No categories are over budget.",
  ];

  const weekly = getWeeklySummary(data, selectedMonth);
  const monthly = getMonthlySummary(data);

  return {
    monthlyTransactions,
    monthlyIncome,
    monthlySavings,
    incomeTotal,
    spendingTotal,
    savingsTotal,
    owedTotal,
    leftover,
    categorySpending,
    savingsByLocation,
    savingsByPurpose,
    categoryBudgets,
    savingsProgress,
    insights,
    weekly,
    monthly,
  };
}

export function getWeeklySummary(data, selectedMonth) {
  const start = parseLocalDate(`${selectedMonth}-01`);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
  const firstWeek = getWeekStart(`${selectedMonth}-01`);
  const cursor = parseLocalDate(firstWeek);
  const rows = [];

  while (cursor <= end) {
    const weekStart = cursor.toISOString().slice(0, 10);
    const weekEnd = new Date(cursor);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const tx = data.transactions.filter((item) => {
      const date = parseLocalDate(item.date);
      return date >= cursor && date < weekEnd;
    });
    const inc = data.income.filter((item) => {
      const date = parseLocalDate(item.date);
      return date >= cursor && date < weekEnd;
    });
    const sav = data.savings.filter((item) => {
      const date = parseLocalDate(item.date);
      return date >= cursor && date < weekEnd;
    });
    const spending = sum(tx);
    const income = sum(inc);
    const savings = sum(sav);

    rows.push({
      weekStart,
      label: toShortDate(weekStart),
      spending,
      income,
      savings,
      net: income - spending - savings,
      categories: Object.fromEntries(data.lists.categories.map((cat) => [cat, sum(tx.filter((item) => item.category === cat))])),
    });
    cursor.setDate(cursor.getDate() + 7);
  }

  return rows;
}

export function getMonthlySummary(data) {
  return getAvailableMonths(data).sort().map((month) => {
    const transactions = data.transactions.filter((item) => inMonth(item, month));
    const income = data.income.filter((item) => inMonth(item, month));
    const savings = data.savings.filter((item) => inMonth(item, month));
    const spending = sum(transactions);
    const incomeTotal = sum(income);
    const savingsTotal = sum(savings);
    return {
      month,
      label: monthLabel(month),
      spending,
      income: incomeTotal,
      savings: savingsTotal,
      net: incomeTotal - spending - savingsTotal,
      categories: Object.fromEntries(data.lists.categories.map((cat) => [cat, sum(transactions.filter((item) => item.category === cat))])),
    };
  });
}

export function downloadJson(data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `budget-data-${todayISO()}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
