import type { Loan } from "./../lib/types";

export function getDaysLeft(loan: Loan): number {
  const today = new Date().toISOString().slice(0, 10);
  const due = loan.due_date.slice(0, 10);
  return Math.round((new Date(due + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) / 86400000);
}

export function loanStatusLabel(loan: Loan): { label: string; className: string } {
  if (loan.status === "closed") return { label: "CLOSED", className: "text-inkSoft" };

  const daysLeft = getDaysLeft(loan);

  if (daysLeft < 0) return { label: "OVERDUE", className: "text-rust" };
  if (daysLeft === 0) return { label: "DUE TODAY", className: "text-rust" };
  if (daysLeft <= 3) return { label: "DUE SOON", className: "text-gold" };
  return { label: "ACTIVE", className: "text-sage" };
}

export default function StatusBadge({ loan }: { loan: Loan }) {
  const { label, className } = loanStatusLabel(loan);
  return <span className={`stamp ${className}`}>{label}</span>;
}
