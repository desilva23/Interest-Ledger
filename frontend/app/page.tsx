"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Protected from "@/components/Protected";
import StatusBadge, { loanStatusLabel } from "@/components/StatusBadge";
import { api } from "@/lib/api";
import type { Loan, Payee, LifetimeReport } from "@/lib/types";

function inr(n: number | string) {
  return "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}
function fmtDate(iso: string) {
  return new Date(iso.slice(0, 10) + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function DashboardPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [payees, setPayees] = useState<Payee[]>([]);
  const [lifetime, setLifetime] = useState<LifetimeReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [loansRes, payeesRes, lifetimeRes] = await Promise.all([
          api.get<{ loans: Loan[] }>("/api/loans"),
          api.get<{ payees: Payee[] }>("/api/payees"),
          api.get<LifetimeReport>("/api/reports/lifetime"),
        ]);
        setLoans(loansRes.loans);
        setPayees(payeesRes.payees);
        setLifetime(lifetimeRes);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const payeeMap = useMemo(() => Object.fromEntries(payees.map((p) => [p.id, p])), [payees]);

  const attention = useMemo(() => {
    return loans
      .filter((l) => ["OVERDUE", "DUE TODAY", "DUE SOON"].includes(loanStatusLabel(l).label))
      .sort((a, b) => a.due_date.localeCompare(b.due_date));
  }, [loans]);

  if (loading) return <Protected><p className="text-inkSoft text-sm">Loading…</p></Protected>;

  return (
    <Protected>
      <h1 className="font-display text-xl font-bold mb-4">Today&apos;s ledger</h1>

      {lifetime && (
        <div className="grid gap-3 mb-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
          <StatCard label="Outstanding principal" value={inr(lifetime.outstanding_principal)} />
          <StatCard label="Interest earned (lifetime)" value={inr(lifetime.total_interest_earned)} color="text-sage" />
          <StatCard label="Active loans" value={lifetime.active_loans} />
          <StatCard label="Overdue / due soon" value={attention.length} color={attention.length ? "text-rust" : "text-ink"} />
        </div>
      )}

      <h2 className="font-display text-lg font-semibold mb-2">Needs attention</h2>
      {attention.length === 0 ? (
        <div className="ledger-card p-6 text-center text-sm text-inkSoft">
          Nothing due right now. Loans overdue, due today, or due within 3 days will show up here.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {attention.map((loan) => (
            <div key={loan.id} className="ledger-card p-3.5 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <StatusBadge loan={loan} />
                <div>
                  <div className="font-semibold text-sm">{payeeMap[loan.payee_id]?.name || "Unknown payee"}</div>
                  <div className="font-mono text-xs text-inkSoft">{inr(loan.principal)} · due {fmtDate(loan.due_date)}</div>
                </div>
              </div>
              <Link href="/loans" className="text-xs underline text-cover">Go to loans</Link>
            </div>
          ))}
        </div>
      )}
    </Protected>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="ledger-card p-3.5">
      <div className="text-[11px] uppercase tracking-wide text-inkSoft">{label}</div>
      <div className={`font-mono text-xl font-bold mt-1 ${color || "text-ink"}`}>{value}</div>
    </div>
  );
}
