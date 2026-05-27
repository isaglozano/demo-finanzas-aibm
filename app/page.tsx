"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Category =
  | "Food"
  | "Transport"
  | "Shopping"
  | "Bills"
  | "Entertainment"
  | "Other";

type Expense = {
  id: string;
  description: string;
  amount: number;
  category: Category;
  date: string;
};

const CATEGORIES: { name: Category; color: string }[] = [
  { name: "Food", color: "#22c55e" },
  { name: "Transport", color: "#3b82f6" },
  { name: "Shopping", color: "#a855f7" },
  { name: "Bills", color: "#ef4444" },
  { name: "Entertainment", color: "#f59e0b" },
  { name: "Other", color: "#6b7280" },
];

const STORAGE_KEY = "finance-expenses";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function getCategoryColor(category: Category) {
  return CATEGORIES.find((c) => c.name === category)?.color ?? "#6b7280";
}

export default function Home() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<Category>("Food");
  const [expenseDate, setExpenseDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [loaded, setLoaded] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setExpenses(JSON.parse(saved));
      } catch {
        setExpenses([]);
      }
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
    }
  }, [expenses, loaded]);

  const total = useMemo(
    () => expenses.reduce((sum, e) => sum + e.amount, 0),
    [expenses],
  );

  const byCategory = useMemo(() => {
    const map = new Map<Category, number>();
    for (const cat of CATEGORIES) {
      map.set(cat.name, 0);
    }
    for (const expense of expenses) {
      map.set(expense.category, (map.get(expense.category) ?? 0) + expense.amount);
    }
    return CATEGORIES.map((cat) => ({
      ...cat,
      amount: map.get(cat.name) ?? 0,
    })).filter((cat) => cat.amount > 0);
  }, [expenses]);

  const pieGradient = useMemo(() => {
    if (total === 0) return "conic-gradient(#e4e4e7 0deg 360deg)";
    let current = 0;
    const stops = byCategory.map((cat) => {
      const start = (current / total) * 360;
      current += cat.amount;
      const end = (current / total) * 360;
      return `${cat.color} ${start}deg ${end}deg`;
    });
    return `conic-gradient(${stops.join(", ")})`;
  }, [byCategory, total]);

  function addExpense(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseFloat(amount);
    if (!description.trim() || isNaN(parsed) || parsed <= 0) return;

    setExpenses((prev) => [
      {
        id: crypto.randomUUID(),
        description: description.trim(),
        amount: parsed,
        category,
        date: expenseDate,
      },
      ...prev,
    ]);
    setDescription("");
    setAmount("");
    setExpenseDate(new Date().toISOString().slice(0, 10));
    clearReceiptPreview();
  }

  function removeExpense(id: string) {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }

  async function scanReceipt(file: File) {
    setScanning(true);
    setScanError(null);

    const previewUrl = URL.createObjectURL(file);
    setReceiptPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return previewUrl;
    });

    try {
      const formData = new FormData();
      formData.append("receipt", file);

      const response = await fetch("/api/scan-receipt", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to scan receipt");
      }

      setDescription(data.description);
      setAmount(String(data.amount));
      setCategory(data.category as Category);
      if (data.date) setExpenseDate(data.date);
    } catch (err) {
      setScanError(
        err instanceof Error ? err.message : "Failed to scan receipt",
      );
    } finally {
      setScanning(false);
    }
  }

  function handleReceiptSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) scanReceipt(file);
    e.target.value = "";
  }

  function clearReceiptPreview() {
    setReceiptPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setScanError(null);
  }

  return (
    <div className="min-h-full bg-zinc-50 text-zinc-900">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">
            Personal Finance
          </h1>
          <p className="mt-1 text-zinc-500">
            Track expenses by category — upload a receipt and let AI categorize
            it for you.
          </p>
        </header>

        <div className="mb-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-zinc-500">Total spent</p>
          <p className="mt-1 text-4xl font-semibold tabular-nums">
            {formatCurrency(total)}
          </p>
          <p className="mt-1 text-sm text-zinc-400">
            {expenses.length} expense{expenses.length !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">Add expense</h2>

            <div className="mb-6 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-zinc-700">
                    Scan receipt with AI
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    Upload a photo and Gemini will read and categorize it
                    automatically.
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
                  Gemini
                </span>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                onChange={handleReceiptSelect}
                className="hidden"
                aria-label="Upload receipt image"
              />

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={scanning}
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {scanning ? "Analyzing receipt…" : "Upload receipt"}
                </button>
                {receiptPreview && !scanning && (
                  <button
                    type="button"
                    onClick={clearReceiptPreview}
                    className="rounded-lg px-3 py-2 text-sm text-zinc-500 transition hover:bg-zinc-200/60"
                  >
                    Clear preview
                  </button>
                )}
              </div>

              {receiptPreview && (
                <div className="mt-3 overflow-hidden rounded-lg border border-zinc-200 bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={receiptPreview}
                    alt="Receipt preview"
                    className="max-h-40 w-full object-contain"
                  />
                </div>
              )}

              {scanning && (
                <p className="mt-2 text-sm text-violet-600">
                  Reading receipt with Gemini…
                </p>
              )}

              {scanError && (
                <p className="mt-2 text-sm text-red-600">{scanError}</p>
              )}
            </div>

            <form onSubmit={addExpense} className="space-y-4">
              <div>
                <label
                  htmlFor="description"
                  className="mb-1 block text-sm font-medium text-zinc-600"
                >
                  Description
                </label>
                <input
                  id="description"
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Coffee, groceries..."
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="amount"
                    className="mb-1 block text-sm font-medium text-zinc-600"
                  >
                    Amount
                  </label>
                  <input
                    id="amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100"
                  />
                </div>
                <div>
                  <label
                    htmlFor="category"
                    className="mb-1 block text-sm font-medium text-zinc-600"
                  >
                    Category
                  </label>
                  <select
                    id="category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as Category)}
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat.name} value={cat.name}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                type="submit"
                className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-700"
              >
                Add expense
              </button>
            </form>
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">By category</h2>
            {byCategory.length === 0 ? (
              <p className="text-sm text-zinc-400">
                Add expenses to see the breakdown.
              </p>
            ) : (
              <div className="flex flex-col items-center gap-6 sm:flex-row">
                <div className="relative h-36 w-36 shrink-0">
                  <div
                    className="h-full w-full rounded-full"
                    style={{ background: pieGradient }}
                  />
                  <div className="absolute inset-0 m-auto flex h-20 w-20 items-center justify-center rounded-full bg-white text-center">
                    <span className="text-xs font-medium text-zinc-500">
                      {byCategory.length} cat.
                    </span>
                  </div>
                </div>
                <div className="w-full space-y-3">
                  {byCategory.map((cat) => {
                    const pct = total > 0 ? (cat.amount / total) * 100 : 0;
                    return (
                      <div key={cat.name}>
                        <div className="mb-1 flex justify-between text-sm">
                          <span className="flex items-center gap-2">
                            <span
                              className="inline-block h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: cat.color }}
                            />
                            {cat.name}
                          </span>
                          <span className="tabular-nums text-zinc-600">
                            {formatCurrency(cat.amount)}
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: cat.color,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        </div>

        <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Recent expenses</h2>
          {expenses.length === 0 ? (
            <p className="text-sm text-zinc-400">
              No expenses yet. Add your first one above.
            </p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {expenses.map((expense) => (
                <li
                  key={expense.id}
                  className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{expense.description}</p>
                    <p className="mt-0.5 flex items-center gap-2 text-sm text-zinc-500">
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{
                          backgroundColor: getCategoryColor(expense.category),
                        }}
                      />
                      {expense.category} · {expense.date}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium tabular-nums">
                      {formatCurrency(expense.amount)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeExpense(expense.id)}
                      className="rounded-lg px-2.5 py-1.5 text-sm text-red-600 transition hover:bg-red-50"
                      aria-label={`Remove ${expense.description}`}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
