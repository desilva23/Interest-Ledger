export type InterestType = "flat" | "monthly" | "daily";
export type LoanStatus = "active" | "closed";

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Payee {
  id: string;
  user_id: string;
  name: string;
  mobile: string | null;
  notes: string | null;
  status: "active" | "inactive";
  created_at: string;
}

export interface Loan {
  id: string;
  user_id: string;
  payee_id: string;
  principal: string;
  interest_rate: string;
  interest_type: InterestType;
  start_date: string;
  initial_duration_days: number;
  due_date: string;
  initial_interest: string;
  extra_interest: string;
  status: LoanStatus;
  notes: string | null;
  closed_date: string | null;
  created_at: string;
}

export interface Extension {
  id: string;
  loan_id: string;
  previous_due_date: string;
  new_due_date: string;
  additional_days: number;
  additional_interest: string;
  created_at: string;
}

export interface Payment {
  id: string;
  loan_id: string;
  interest_amount: string;
  principal_amount: string;
  payment_date: string;
  notes: string | null;
  created_at: string;
}

export interface MonthlyReportRow {
  month: string;
  interest: string;
  principal: string;
}

export interface LifetimeReport {
  total_lent: string;
  total_loans: string;
  active_loans: string;
  closed_loans: string;
  total_interest_earned: string;
  total_principal_returned: string;
  total_payees: string;
  outstanding_principal: string;
}
