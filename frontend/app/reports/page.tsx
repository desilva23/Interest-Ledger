"use client";

import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import Protected from "@/components/Protected";
import { api } from "@/lib/api";
import type { MonthlyReportRow, LifetimeReport } from "@/lib/types";

function inr(n: number | string) {
  return "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}
function monthLabel(key: string) {
  const [y, m] = key.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
}

export default function ReportsPage() {
  const [months, setMonths] = useState<MonthlyReportRow[]>([]);
  const [lifetime, setLifetime] = useState<LifetimeReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [monthlyRes, lifetimeRes] = await Promise.all([
        api.get<{ months: MonthlyReportRow[] }>("/api/reports/monthly"),
        api.get<LifetimeReport>("/api/reports/lifetime"),
      ]);
      setMonths(monthlyRes.months);
      setLifetime(lifetimeRes);
      setLoading(false);
    })();
  }, []);

  const chartData = months.map((m) => ({ label: monthLabel(m.month), interest: Number(m.interest), principal: Number(m.principal) }));

  if (loading) return <Protected><p className="text-sm text-inkSoft">Loading…</p></Protected>;

  return (
    <Protected>
      <h1 className="font-display text-xl font-bold mb-4">Reports</h1>

      {lifetime && (
        <div className="grid gap-3 mb-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
          <Stat label="Total lent (lifetime)" value={inr(lifetime.total_lent)} />
          <Stat label="Interest earned (lifetime)" value={inr(lifetime.total_interest_earned)} color="text-sage" />
          <Stat label="Principal returned" value={inr(lifetime.total_principal_returned)} />
          <Stat label="Payees · loans" value={`${lifetime.total_payees} · ${lifetime.total_loans}`} />
        </div>
      )}

      <h2 className="font-display text-lg font-semibold mb-2">Monthly collections</h2>
      {chartData.length === 0 ? (
        <div className="ledger-card p-6 text-center text-sm text-inkSoft">No payments recorded yet. Monthly totals will appear here once you do.</div>
      ) : (
        <div className="ledger-card p-3">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(27,36,48,0.12)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} width={40} />
              <Tooltip formatter={(v: number) => inr(v)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="interest" name="Interest" fill="#B8923D" radius={[3, 3, 0, 0]} />
              <Bar dataKey="principal" name="Principal returned" fill="#5F8567" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Protected>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="ledger-card p-3.5">
      <div className="text-[11px] uppercase tracking-wide text-inkSoft">{label}</div>
      <div className={`font-mono text-xl font-bold mt-1 ${color || "text-ink"}`}>{value}</div>
    </div>
  );
}
