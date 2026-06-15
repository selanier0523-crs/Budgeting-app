import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toCurrency } from "../lib/budgetData";

const chartColors = ["#0f766e", "#2563eb", "#d97706", "#be123c", "#7c3aed", "#0891b2", "#65a30d", "#9333ea", "#475569"];

export function SpendingCategoryChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={270}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} angle={-18} textAnchor="end" height={70} />
        <YAxis tickFormatter={(value) => `$${value}`} width={54} />
        <Tooltip formatter={(value) => toCurrency(value)} />
        <Bar dataKey="amount" radius={[6, 6, 0, 0]} fill="#0f766e" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function WeeklyTrendChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={270}>
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" />
        <YAxis tickFormatter={(value) => `$${value}`} width={54} />
        <Tooltip formatter={(value) => toCurrency(value)} />
        <Legend />
        <Area type="monotone" dataKey="income" name="Income" stroke="#16a34a" fill="#bbf7d0" />
        <Area type="monotone" dataKey="spending" name="Spending" stroke="#2563eb" fill="#bfdbfe" />
        <Area type="monotone" dataKey="savings" name="Savings" stroke="#d97706" fill="#fed7aa" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function SavingsLocationChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={data} dataKey="amount" nameKey="name" innerRadius={58} outerRadius={96} paddingAngle={3}>
          {data.map((entry, index) => (
            <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => toCurrency(value)} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
