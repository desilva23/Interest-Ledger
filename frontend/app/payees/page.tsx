"use client";

import { useEffect, useState } from "react";
import Protected from "@/components/Protected";
import { api } from "@/lib/api";
import type { Payee } from "@/lib/types";

export default function PayeesPage() {
  const [payees, setPayees] = useState<Payee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Payee | null>(null);

  async function load() {
    const res = await api.get<{ payees: Payee[] }>("/api/payees");
    setPayees(res.payees);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function handleDelete(id: string) {
    await api.delete(`/api/payees/${id}`);
    load();
  }

  return (
    <Protected>
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-xl font-bold">Payees</h1>
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="bg-cover text-goldBg text-sm font-semibold px-3.5 py-1.5 rounded"
        >
          + Add payee
        </button>
      </div>

      {showForm && (
        <PayeeForm
          initial={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            load();
          }}
        />
      )}

      {loading ? (
        <p className="text-sm text-inkSoft">Loading…</p>
      ) : payees.length === 0 ? (
        <div className="ledger-card p-6 text-center text-sm text-inkSoft">No payees yet. Add the first person you&apos;re lending to.</div>
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          {payees.map((p) => (
            <div key={p.id} className="ledger-card p-3.5">
              <div className="font-semibold">{p.name}</div>
              {p.mobile && <div className="text-xs text-inkSoft">{p.mobile}</div>}
              {p.notes && <div className="text-xs text-inkSoft italic mt-1">{p.notes}</div>}
              <div className="flex items-center gap-3 mt-3 pt-2 border-t border-dashed border-black/10 text-xs">
                <button
                  className="underline"
                  onClick={() => {
                    setEditing(p);
                    setShowForm(true);
                  }}
                >
                  Edit
                </button>
                <button className="underline text-rust" onClick={() => handleDelete(p.id)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Protected>
  );
}

function PayeeForm({ initial, onClose, onSaved }: { initial: Payee | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(initial?.name || "");
  const [mobile, setMobile] = useState(initial?.mobile || "");
  const [notes, setNotes] = useState(initial?.notes || "");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (initial) await api.put(`/api/payees/${initial.id}`, { name, mobile, notes });
      else await api.post("/api/payees", { name, mobile, notes });
      onSaved();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="ledger-card p-4 mb-5">
      <div className="grid sm:grid-cols-3 gap-3">
        <input className="ledger-input" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
        <input className="ledger-input" placeholder="Mobile (optional)" value={mobile} onChange={(e) => setMobile(e.target.value)} />
        <input className="ledger-input" placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="flex gap-2 mt-3">
        <button disabled={submitting} className="bg-cover text-goldBg text-sm font-semibold px-3.5 py-1.5 rounded">
          {submitting ? "Saving…" : "Save payee"}
        </button>
        <button type="button" onClick={onClose} className="text-sm px-3.5 py-1.5">
          Cancel
        </button>
      </div>
    </form>
  );
}
