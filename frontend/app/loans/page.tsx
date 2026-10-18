"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Protected from "@/components/Protected";
import StatusBadge, { getDaysLeft } from "@/components/StatusBadge";
import { api } from "@/lib/api";
import type { Loan, Payee, Payment } from "@/lib/types";

type Toast = { id: number; message: string; kind: "success" | "error" };

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong";
}

function inr(n: number | string) {
  return "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}
function fmtDate(iso: string) {
  return new Date(iso.slice(0, 10) + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function calcInterest(principal: number, rate: number, type: string, days: number) {
  let interest = 0;
  if (type === "daily") interest = principal * (rate / 100) * days;
  else if (type === "monthly") interest = principal * (rate / 100) * (days / 30);
  else interest = principal * (rate / 100);
  return interest;
}

// Date Helpers
function toLocalISOString(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addDays(dateStr: string, daysNum: number): string {
  if (!dateStr) return "";
  const date = new Date(dateStr + "T00:00:00");
  date.setDate(date.getDate() + daysNum);
  return toLocalISOString(date);
}

function addMonths(dateStr: string, monthsNum: number): string {
  if (!dateStr) return "";
  const date = new Date(dateStr + "T00:00:00");
  date.setMonth(date.getMonth() + monthsNum);
  return toLocalISOString(date);
}

function diffDays(startStr: string, endStr: string): number {
  if (!startStr || !endStr) return 0;
  const start = new Date(startStr + "T00:00:00");
  const end = new Date(endStr + "T00:00:00");
  const diffTime = end.getTime() - start.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

export default function LoansPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [payees, setPayees] = useState<Payee[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [paymentFor, setPaymentFor] = useState<Loan | null>(null);
  const [extendFor, setExtendFor] = useState<Loan | null>(null);
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);
  const [showClosed, setShowClosed] = useState(false);
  const [search, setSearch] = useState("");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  function showToast(message: string, kind: Toast["kind"] = "success") {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }

  async function load() {
    const [loansRes, payeesRes, paymentsRes] = await Promise.all([
      api.get<{ loans: Loan[] }>("/api/loans"),
      api.get<{ payees: Payee[] }>("/api/payees"),
      api.get<{ payments: Payment[] }>("/api/payments"),
    ]);
    setLoans(loansRes.loans);
    setPayees(payeesRes.payees);
    setPayments(paymentsRes.payments);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  const payeeMap = useMemo(() => Object.fromEntries(payees.map((p) => [p.id, p])), [payees]);
  const paidByLoan = useMemo(() => {
    const map: Record<string, { interestPaid: number; principalPaid: number }> = {};
    for (const p of payments) {
      const entry = map[p.loan_id] || { interestPaid: 0, principalPaid: 0 };
      entry.interestPaid += Number(p.interest_amount);
      entry.principalPaid += Number(p.principal_amount);
      map[p.loan_id] = entry;
    }
    return map;
  }, [payments]);
  function loanDue(loan: Loan) {
    const paid = paidByLoan[loan.id] || { interestPaid: 0, principalPaid: 0 };
    const interestAccrued = Number(loan.initial_interest) + Number(loan.extra_interest);
    return {
      interestDue: Math.max(interestAccrued - paid.interestPaid, 0),
      principalDue: Math.max(Number(loan.principal) - paid.principalPaid, 0),
      interestPaid: paid.interestPaid,
      principalPaid: paid.principalPaid,
    };
  }
  const activeLoans = useMemo(
    () => loans.filter((l) => l.status !== "closed").sort((a, b) => getDaysLeft(a) - getDaysLeft(b)),
    [loans]
  );
  const closedLoans = useMemo(
    () =>
      loans
        .filter((l) => l.status === "closed")
        .sort((a, b) => (b.closed_date || b.due_date).localeCompare(a.closed_date || a.due_date)),
    [loans]
  );
  const searchTerm = search.trim().toLowerCase();
  function matchesSearch(loan: Loan) {
    if (!searchTerm) return true;
    return (payeeMap[loan.payee_id]?.name || "").toLowerCase().includes(searchTerm);
  }
  const visibleActiveLoans = useMemo(() => activeLoans.filter(matchesSearch), [activeLoans, searchTerm, payeeMap]);
  const visibleClosedLoans = useMemo(() => closedLoans.filter(matchesSearch), [closedLoans, searchTerm, payeeMap]);
  const summary = useMemo(() => {
    let outstanding = 0;
    let overdue = 0;
    let dueSoon = 0;
    for (const loan of activeLoans) {
      const due = loanDue(loan);
      outstanding += due.principalDue + due.interestDue;
      const daysLeft = getDaysLeft(loan);
      if (daysLeft < 0) overdue++;
      else if (daysLeft <= 3) dueSoon++;
    }
    return { outstanding, overdue, dueSoon };
  }, [activeLoans, paidByLoan]);

  async function handleToggleClose(loan: Loan) {
    try {
      await api.put(`/api/loans/${loan.id}`, { status: loan.status === "closed" ? "active" : "closed" });
      showToast(loan.status === "closed" ? "Loan reopened" : "Loan closed");
      load();
    } catch (err) {
      showToast(errorMessage(err), "error");
    }
  }
  async function handleDelete(loan: Loan) {
    if (!window.confirm(`Delete this ${inr(loan.principal)} loan to ${payeeMap[loan.payee_id]?.name || "this payee"}? This cannot be undone.`)) {
      return;
    }
    try {
      await api.delete(`/api/loans/${loan.id}`);
      showToast("Loan deleted");
      load();
    } catch (err) {
      showToast(errorMessage(err), "error");
    }
  }

  return (
    <Protected>
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <h1 className="font-display text-xl font-bold">Loans</h1>
        <button onClick={() => setShowForm(true)} className="bg-cover text-goldBg text-sm font-semibold px-3.5 py-1.5 rounded">
          + Add loan
        </button>
      </div>

      {!loading && loans.length > 0 && (
        <input
          type="text"
          className="ledger-input mb-4"
          placeholder="Search by payee name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      )}

      {showForm && (
        <LoanForm
          payees={payees}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            showToast("Loan saved");
            load();
          }}
        />
      )}
      {paymentFor && (
        <PaymentForm
          loan={paymentFor}
          payeeName={payeeMap[paymentFor.payee_id]?.name}
          onClose={() => setPaymentFor(null)}
          onSaved={() => {
            setPaymentFor(null);
            showToast("Payment recorded");
            load();
          }}
          onError={(err) => showToast(errorMessage(err), "error")}
        />
      )}
      {extendFor && (
        <ExtendForm
          loan={extendFor}
          payeeName={payeeMap[extendFor.payee_id]?.name}
          onClose={() => setExtendFor(null)}
          onSaved={() => {
            setExtendFor(null);
            showToast("Loan extended");
            load();
          }}
          onError={(err) => showToast(errorMessage(err), "error")}
        />
      )}
      {editingLoan && (
        <LoanForm
          payees={payees}
          editingLoan={editingLoan}
          onClose={() => setEditingLoan(null)}
          onSaved={() => {
            setEditingLoan(null);
            showToast("Loan saved");
            load();
          }}
        />
      )}

      {!loading && loans.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="ledger-card p-3 text-center">
            <div className="font-mono font-bold text-gold">{inr(summary.outstanding)}</div>
            <div className="text-[10px] text-inkSoft uppercase tracking-wider">Outstanding ({activeLoans.length} active)</div>
          </div>
          <div className="ledger-card p-3 text-center">
            <div className="font-mono font-bold text-rust">{summary.overdue}</div>
            <div className="text-[10px] text-inkSoft uppercase tracking-wider">Overdue</div>
          </div>
          <div className="ledger-card p-3 text-center">
            <div className="font-mono font-bold text-gold">{summary.dueSoon}</div>
            <div className="text-[10px] text-inkSoft uppercase tracking-wider">Due soon</div>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-inkSoft">Loading…</p>
      ) : loans.length === 0 ? (
        <div className="ledger-card p-6 text-center text-sm text-inkSoft">No loans yet. Add a payee, then record your first loan.</div>
      ) : (
        <>
          {visibleActiveLoans.length === 0 ? (
            <div className="ledger-card p-6 text-center text-sm text-inkSoft">
              {activeLoans.length === 0 ? "No active loans." : "No active loans match your search."}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {visibleActiveLoans.map((loan) => (
                <LoanCard
                  key={loan.id}
                  loan={loan}
                  payeeName={payeeMap[loan.payee_id]?.name}
                  due={loanDue(loan)}
                  payments={payments.filter((p) => p.loan_id === loan.id)}
                  onRecordPayment={() => setPaymentFor(loan)}
                  onExtend={() => setExtendFor(loan)}
                  onToggleClose={() => handleToggleClose(loan)}
                  onEdit={() => setEditingLoan(loan)}
                  onDelete={() => handleDelete(loan)}
                />
              ))}
            </div>
          )}

          {visibleClosedLoans.length > 0 && (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setShowClosed((v) => !v)}
                className="flex items-center gap-1.5 text-xs font-semibold text-inkSoft underline"
              >
                <span className={`inline-block transition-transform ${showClosed ? "rotate-90" : ""}`}>▶</span>
                Closed loans ({visibleClosedLoans.length})
              </button>
              {showClosed && (
                <div className="flex flex-col gap-2 mt-2">
                  {visibleClosedLoans.map((loan) => (
                    <LoanCard
                      key={loan.id}
                      loan={loan}
                      payeeName={payeeMap[loan.payee_id]?.name}
                      due={loanDue(loan)}
                      payments={payments.filter((p) => p.loan_id === loan.id)}
                      onRecordPayment={() => setPaymentFor(loan)}
                      onExtend={() => setExtendFor(loan)}
                      onToggleClose={() => handleToggleClose(loan)}
                      onEdit={() => setEditingLoan(loan)}
                      onDelete={() => handleDelete(loan)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-50">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`ledger-card px-3.5 py-2 text-sm font-semibold shadow-lg ${t.kind === "error" ? "text-rust" : "text-sage"}`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </Protected>
  );
}

function LoanCard({
  loan,
  payeeName,
  due,
  payments,
  onRecordPayment,
  onExtend,
  onToggleClose,
  onEdit,
  onDelete,
}: {
  loan: Loan;
  payeeName?: string;
  due: { interestDue: number; principalDue: number; interestPaid: number; principalPaid: number };
  payments: Payment[];
  onRecordPayment: () => void;
  onExtend: () => void;
  onToggleClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [showHistory, setShowHistory] = useState(false);
  const totalPaid = due.interestPaid + due.principalPaid;
  return (
    <div className="ledger-card p-3.5">
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold">{payeeName || "Unknown payee"}</span>
            <StatusBadge loan={loan} />
          </div>
          <div className="font-mono text-xs text-inkSoft mt-1">
            {inr(loan.principal)}
            {due.principalPaid > 0 && ` (${inr(due.principalDue)} due)`} · {loan.interest_rate}% {loan.interest_type} · started {fmtDate(loan.start_date)} · due {fmtDate(loan.due_date)}
          </div>
          {loan.notes && (
            <div className="text-xs text-inkSoft mt-1.5 italic bg-black/5 px-2.5 py-1 rounded inline-block">
              Note: {loan.notes}
            </div>
          )}
        </div>
        <div className="text-right">
          <div className="font-mono font-bold text-gold">{inr(due.interestDue)}</div>
          <div className="text-[10px] text-inkSoft">interest due</div>
          {totalPaid > 0 && <div className="text-[10px] text-sage mt-0.5">{inr(totalPaid)} paid so far</div>}
        </div>
      </div>
      <div className="flex gap-2 mt-2.5 pt-2.5 border-t border-dashed border-black/10 text-xs flex-wrap">
        <button className="underline text-sage" onClick={onRecordPayment}>Record payment</button>
        {loan.status !== "closed" && <button className="underline text-gold" onClick={onExtend}>Extend</button>}
        <button className="underline" onClick={onToggleClose}>{loan.status === "closed" ? "Reopen" : "Close loan"}</button>
        <button className="underline text-cover font-semibold" onClick={onEdit}>Edit</button>
        <button className="underline text-rust" onClick={onDelete}>Delete</button>
        {payments.length > 0 && (
          <button className="underline text-inkSoft ml-auto" onClick={() => setShowHistory((v) => !v)}>
            {showHistory ? "Hide" : "History"} ({payments.length})
          </button>
        )}
      </div>
      {showHistory && (
        <div className="mt-2 pt-2 border-t border-dashed border-black/10 flex flex-col gap-1">
          {payments.map((p) => (
            <div key={p.id} className="flex justify-between text-xs font-mono text-inkSoft">
              <span>{fmtDate(p.payment_date)}</span>
              <span>
                {Number(p.interest_amount) > 0 && `${inr(p.interest_amount)} interest`}
                {Number(p.interest_amount) > 0 && Number(p.principal_amount) > 0 && " + "}
                {Number(p.principal_amount) > 0 && `${inr(p.principal_amount)} principal`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LoanForm({ 
  payees, 
  onClose, 
  onSaved, 
  editingLoan 
}: { 
  payees: Payee[]; 
  onClose: () => void; 
  onSaved: () => void; 
  editingLoan?: Loan | null;
}) {
  const [payeeId, setPayeeId] = useState(editingLoan?.payee_id || payees[0]?.id || "");
  const [principal, setPrincipal] = useState(editingLoan?.principal ? Number(editingLoan.principal).toString() : "");
  const [rate, setRate] = useState(editingLoan?.interest_rate ? Number(editingLoan.interest_rate).toString() : "");
  const [customInterest, setCustomInterest] = useState(editingLoan?.initial_interest ? Number(editingLoan.initial_interest).toString() : ""); // Interest for the actual duration
  const [totalReceivable, setTotalReceivable] = useState(
    editingLoan ? (Number(editingLoan.principal) + Number(editingLoan.initial_interest)).toString() : ""
  ); // Total receivable for the actual duration
  const [duration, setDuration] = useState(editingLoan?.initial_duration_days ? editingLoan.initial_duration_days.toString() : "30");
  const [startDate, setStartDate] = useState(editingLoan?.start_date ? editingLoan.start_date.slice(0, 10) : toLocalISOString(new Date()));
  const [notes, setNotes] = useState(editingLoan?.notes || "");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<"day-wise" | "monthly">(
    editingLoan?.interest_type === "flat" ? "monthly" : "day-wise"
  );

  const [dueDate, setDueDate] = useState(() => {
    if (editingLoan?.due_date) {
      return editingLoan.due_date.slice(0, 10);
    }
    const initialStart = editingLoan?.start_date ? editingLoan.start_date.slice(0, 10) : toLocalISOString(new Date());
    const initialDuration = editingLoan?.initial_duration_days ? editingLoan.initial_duration_days : 30;
    if (editingLoan?.interest_type === "flat") {
      return addMonths(initialStart, 1);
    } else {
      return addDays(initialStart, initialDuration);
    }
  });

  const pVal = Number(principal) || 0;
  const rVal = Number(rate) || 0;
  const days = Number(duration) || 0;

  // Final calculated values to display and send to backend
  const finalInterest = Number(customInterest) || 0;
  const finalTotal = pVal + finalInterest;

  // Effect to automatically scale interest/total receivable when the duration (days) changes
  useEffect(() => {
    if (billingCycle === "day-wise" && rVal > 0 && pVal > 0 && days > 0) {
      const newInterest = pVal * (rVal / 100) * (days / 30);
      setCustomInterest(newInterest.toFixed(2));
      setTotalReceivable((pVal + newInterest).toFixed(2));
    }
  }, [days, billingCycle]);

  // Handlers to synchronize inputs in real-time
  const handlePrincipalChange = (val: string) => {
    setPrincipal(val);
    const p = Number(val) || 0;
    if (rVal > 0) {
      const newInterest = billingCycle === "day-wise" && days > 0
        ? p * (rVal / 100) * (days / 30)
        : p * (rVal / 100);
      setCustomInterest(newInterest.toFixed(2));
      setTotalReceivable((p + newInterest).toFixed(2));
    } else {
      const i = Number(customInterest) || 0;
      setTotalReceivable(i > 0 ? (p + i).toFixed(2) : "");
    }
  };

  const handleRateChange = (val: string) => {
    setRate(val);
    const r = Number(val) || 0;
    if (pVal > 0) {
      const newInterest = billingCycle === "day-wise" && days > 0
        ? pVal * (r / 100) * (days / 30)
        : pVal * (r / 100);
      setCustomInterest(newInterest.toFixed(2));
      setTotalReceivable((pVal + newInterest).toFixed(2));
    }
  };

  const handleCustomInterestChange = (val: string) => {
    setCustomInterest(val);
    const i = Number(val) || 0;
    const baseInterest = billingCycle === "day-wise" && days > 0 ? (i * 30) / days : i;
    const r = pVal > 0 ? (baseInterest / pVal) * 100 : 0;
    setRate(r > 0 ? r.toFixed(2) : "");
    setTotalReceivable(i > 0 ? (pVal + i).toFixed(2) : "");
  };

  const handleTotalReceivableChange = (val: string) => {
    setTotalReceivable(val);
    const total = Number(val) || 0;
    const i = Math.max(total - pVal, 0);
    setCustomInterest(i > 0 ? i.toFixed(2) : "");
    const baseInterest = billingCycle === "day-wise" && days > 0 ? (i * 30) / days : i;
    const r = pVal > 0 ? (baseInterest / pVal) * 100 : 0;
    setRate(r > 0 ? r.toFixed(2) : "");
  };

  const handleBillingCycleChange = (newCycle: "day-wise" | "monthly") => {
    setBillingCycle(newCycle);
    if (newCycle === "monthly") {
      // Set due date to exactly 1 month from start date
      const nextDue = addMonths(startDate, 1);
      setDueDate(nextDue);
      const newDays = diffDays(startDate, nextDue);
      setDuration(newDays.toString());
      
      // Calculate flat interest
      if (pVal > 0 && rVal > 0) {
        const newInterest = pVal * (rVal / 100);
        setCustomInterest(newInterest.toFixed(2));
        setTotalReceivable((pVal + newInterest).toFixed(2));
      }
    } else {
      // Day-wise pro-rata
      if (pVal > 0 && rVal > 0 && days > 0) {
        const newInterest = pVal * (rVal / 100) * (days / 30);
        setCustomInterest(newInterest.toFixed(2));
        setTotalReceivable((pVal + newInterest).toFixed(2));
      }
    }
  };

  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    if (billingCycle === "monthly") {
      const nextDue = addMonths(val, 1);
      setDueDate(nextDue);
      const newDays = diffDays(val, nextDue);
      setDuration(newDays.toString());
    } else {
      const daysNum = Number(duration) || 0;
      if (val && daysNum > 0) {
        setDueDate(addDays(val, daysNum));
      }
    }
  };

  const handleDurationChange = (val: string) => {
    setDuration(val);
    const daysNum = Number(val) || 0;
    if (startDate && daysNum > 0) {
      setDueDate(addDays(startDate, daysNum));
    }
  };

  const handleDueDateChange = (val: string) => {
    setDueDate(val);
    if (startDate && val) {
      const diff = diffDays(startDate, val);
      setDuration(diff.toString());
    }
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (pVal === 0 && finalInterest === 0) {
      setFormError("Please enter either a principal amount or interest/rent amount.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        payeeId,
        principal: pVal,
        interestRate: rVal,
        interestType: billingCycle === "monthly" ? "flat" : "monthly",
        startDate,
        durationDays: days,
        initialInterest: finalInterest,
        notes: notes || undefined
      };

      if (editingLoan) {
        await api.put(`/api/loans/${editingLoan.id}`, payload);
      } else {
        await api.post("/api/loans", payload);
      }
      onSaved();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (payees.length === 0) {
    return <div className="ledger-card p-4 mb-5 text-sm text-inkSoft">Add a payee first, then come back to create a loan.</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="ledger-card p-4 mb-5">
      <div className="grid sm:grid-cols-3 gap-3">
        {/* Payee Selection */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-wider font-bold text-inkSoft/80">Payee</label>
          <select className="ledger-input" value={payeeId} onChange={(e) => setPayeeId(e.target.value)}>
            {payees.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* Principal */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-wider font-bold text-inkSoft/80">Principal Amount (₹)</label>
          <input type="number" className="ledger-input" placeholder="0 for rental" value={principal} onChange={(e) => handlePrincipalChange(e.target.value)} />
        </div>

        {/* Interest Rate */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-wider font-bold text-inkSoft/80">Interest Rate (%)</label>
          <input type="number" className="ledger-input" placeholder="e.g. 5" value={rate} onChange={(e) => handleRateChange(e.target.value)} />
        </div>

        {/* Interest / Rent */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-wider font-bold text-inkSoft/80">Interest / Rent (₹)</label>
          <input type="number" className="ledger-input" placeholder="Calculated/Custom" value={customInterest} onChange={(e) => handleCustomInterestChange(e.target.value)} />
        </div>

        {/* Total Receivable */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-wider font-bold text-inkSoft/80">Total Receivable (₹)</label>
          <input type="number" className="ledger-input" placeholder="Calculated/Custom" value={totalReceivable} onChange={(e) => handleTotalReceivableChange(e.target.value)} />
        </div>

        {/* Billing Cycle */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-wider font-bold text-inkSoft/80">Billing Cycle</label>
          <select className="ledger-input" value={billingCycle} onChange={(e) => handleBillingCycleChange(e.target.value as "day-wise" | "monthly")}>
            <option value="day-wise">Day-wise (Pro-rata)</option>
            <option value="monthly">Monthly (Same Date)</option>
          </select>
        </div>

        {/* Start Date */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-wider font-bold text-inkSoft/80">Start Date</label>
          <input type="date" className="ledger-input" value={startDate} onChange={(e) => handleStartDateChange(e.target.value)} required />
        </div>

        {/* Due Date */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-wider font-bold text-inkSoft/80">Due Date</label>
          <input type="date" className="ledger-input" value={dueDate} onChange={(e) => handleDueDateChange(e.target.value)} required disabled={billingCycle === "monthly"} />
        </div>

        {/* Duration */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-wider font-bold text-inkSoft/80">Duration (Days)</label>
          <input type="number" className="ledger-input" value={duration} onChange={(e) => handleDurationChange(e.target.value)} required min="1" disabled={billingCycle === "monthly"} />
        </div>

        {/* Notes */}
        <div className="flex flex-col gap-1 sm:col-span-3">
          <label className="text-[10px] uppercase tracking-wider font-bold text-inkSoft/80">Notes</label>
          <input className="ledger-input" placeholder="e.g. rented bike to friend, item details, etc." value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>

      <div className="bg-goldBg rounded p-3 mt-3 text-sm font-mono flex flex-col gap-1">
        <div className="flex justify-between border-t border-dashed border-black/10 pt-1 mt-1 font-bold">
          <span>Actual Interest/Rent ({duration} days): {inr(finalInterest)}</span>
          <span>Actual Total Receivable: {inr(finalTotal)}</span>
        </div>
      </div>

      {formError && <div className="text-rust text-sm mt-2">{formError}</div>}

      <div className="flex gap-2 mt-3">
        <button disabled={submitting} className="bg-cover text-goldBg text-sm font-semibold px-3.5 py-1.5 rounded">
          {submitting ? "Saving…" : "Save loan"}
        </button>
        <button type="button" onClick={onClose} className="text-sm px-3.5 py-1.5">
          Cancel
        </button>
      </div>
    </form>
  );
}

function PaymentForm({
  loan,
  payeeName,
  onClose,
  onSaved,
  onError,
}: {
  loan: Loan;
  payeeName?: string;
  onClose: () => void;
  onSaved: () => void;
  onError: (err: unknown) => void;
}) {
  const [interestAmount, setInterestAmount] = useState("");
  const [principalAmount, setPrincipalAmount] = useState("");
  const [date, setDate] = useState(toLocalISOString(new Date()));
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if ((Number(interestAmount) || 0) === 0 && (Number(principalAmount) || 0) === 0) {
      onError(new Error("Enter an amount towards interest or principal."));
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/api/payments", {
        loanId: loan.id,
        interestAmount: Number(interestAmount) || 0,
        principalAmount: Number(principalAmount) || 0,
        paymentDate: date,
      });
      onSaved();
    } catch (err) {
      onError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="ledger-card p-4 mb-5">
      <div className="font-display font-semibold mb-2">Record payment — {payeeName}</div>
      <div className="grid sm:grid-cols-3 gap-3">
        <input type="number" className="ledger-input" placeholder="Towards interest (₹)" value={interestAmount} onChange={(e) => setInterestAmount(e.target.value)} />
        <input type="number" className="ledger-input" placeholder="Towards principal (₹)" value={principalAmount} onChange={(e) => setPrincipalAmount(e.target.value)} />
        <input type="date" className="ledger-input" value={date} onChange={(e) => setDate(e.target.value)} required />
      </div>
      <div className="flex gap-2 mt-3">
        <button disabled={submitting} className="bg-cover text-goldBg text-sm font-semibold px-3.5 py-1.5 rounded">
          {submitting ? "Saving…" : "Save payment"}
        </button>
        <button type="button" onClick={onClose} className="text-sm px-3.5 py-1.5">
          Cancel
        </button>
      </div>
    </form>
  );
}

function ExtendForm({
  loan,
  payeeName,
  onClose,
  onSaved,
  onError,
}: {
  loan: Loan;
  payeeName?: string;
  onClose: () => void;
  onSaved: () => void;
  onError: (err: unknown) => void;
}) {
  const [days, setDays] = useState("30");
  const [submitting, setSubmitting] = useState(false);
  const interest = calcInterest(Number(loan.principal), Number(loan.interest_rate), loan.interest_type, Number(days) || 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/api/loan-extension", { loanId: loan.id, additionalDays: Number(days) });
      onSaved();
    } catch (err) {
      onError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="ledger-card p-4 mb-5">
      <div className="font-display font-semibold mb-2">Extend loan — {payeeName}</div>
      <p className="text-sm text-inkSoft mb-3">Current due date: {fmtDate(loan.due_date)}</p>
      <input type="number" className="ledger-input" placeholder="Additional days" value={days} onChange={(e) => setDays(e.target.value)} required min="1" />
      <div className="bg-goldBg rounded p-3 mt-3 text-sm font-mono">Additional interest: {inr(interest)}</div>
      <div className="flex gap-2 mt-3">
        <button disabled={submitting} className="bg-cover text-goldBg text-sm font-semibold px-3.5 py-1.5 rounded">
          {submitting ? "Saving…" : "Confirm extension"}
        </button>
        <button type="button" onClick={onClose} className="text-sm px-3.5 py-1.5">
          Cancel
        </button>
      </div>
    </form>
  );
}
