"use client";

import { useState, FormEvent } from "react";
import { PiBriefcaseFill, PiUserPlusFill, PiProhibitFill } from "react-icons/pi";
import AdminGate from "../../components/admin/AdminGate";
import AdminShell from "../../components/admin/AdminShell";
import { usePartnersAdminTab } from "./usePartnersAdminTab";
import type { PartnerRow } from "./types";

function PartnerCard({
  partner,
  onGrant,
  onRevokeMember,
  onRevokePartner,
  onDelete,
  onError,
}: {
  partner: PartnerRow;
  onGrant: (partnerId: string, email: string) => Promise<void>;
  onRevokeMember: (partnerId: string, memberId: string) => Promise<void>;
  onRevokePartner: (partnerId: string) => Promise<void>;
  onDelete: (partnerId: string) => Promise<void>;
  onError: (msg: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [granting, setGranting] = useState(false);

  const handleGrant = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setGranting(true);
    try {
      await onGrant(partner.id, email.trim());
      setEmail("");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Grant failed");
    } finally {
      setGranting(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-slate-900">{partner.name}</h3>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                partner.status === "active"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {partner.status}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Code: <code className="font-mono">{partner.company_code}</code>
            {partner.contact_email && <> · {partner.contact_email}</>}
          </p>
          {partner.notes && <p className="mt-2 text-sm text-slate-600">{partner.notes}</p>}
        </div>
        <div className="flex gap-2">
          {partner.status === "active" && (
            <button
              type="button"
              onClick={() => onRevokePartner(partner.id).catch((e) => onError(e.message))}
              className="rounded-lg border border-amber-200 px-3 py-1.5 text-xs font-bold text-amber-700 hover:bg-amber-50"
            >
              Revoke org
            </button>
          )}
          <button
            type="button"
            onClick={() => onDelete(partner.id).catch((e) => onError(e.message))}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50"
          >
            Delete
          </button>
        </div>
      </div>

      <form onSubmit={handleGrant} className="mt-4 flex flex-wrap gap-2">
        <input
          type="email"
          placeholder="partner@agency.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={partner.status !== "active" || granting}
          className="min-w-[200px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={partner.status !== "active" || granting || !email.trim()}
          className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-50"
        >
          <PiUserPlusFill className="h-4 w-4" /> Grant access
        </button>
      </form>

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Members ({partner.active_member_count} active)
        </p>
        {partner.members.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">No members yet.</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {partner.members.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm"
              >
                <div>
                  <span className="font-medium text-slate-800">{m.email}</span>
                  <span
                    className={`ml-2 rounded-full px-2 py-0.5 text-xs font-bold ${
                      m.status === "active"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {m.status}
                  </span>
                </div>
                {m.status === "active" && (
                  <button
                    type="button"
                    onClick={() => onRevokeMember(partner.id, m.id).catch((e) => onError(e.message))}
                    className="inline-flex items-center gap-1 text-xs font-bold text-red-600 hover:text-red-700"
                  >
                    <PiProhibitFill className="h-3.5 w-3.5" /> Revoke
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function PartnersAdminPage() {
  const {
    partners,
    loading,
    error,
    setError,
    createPartner,
    grantAccess,
    revokeAccess,
    revokePartner,
    deletePartner,
  } = usePartnersAdminTab();

  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);

  const handleCreate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setCreating(true);
    setError(null);
    try {
      await createPartner({
        name: String(form.get("name") || ""),
        company_code: String(form.get("company_code") || ""),
        contact_email: String(form.get("contact_email") || "") || undefined,
        notes: String(form.get("notes") || "") || undefined,
      });
      setShowForm(false);
      e.currentTarget.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setCreating(false);
    }
  };

  return (
    <AdminGate>
      <AdminShell
        section="partners"
        title="B2B partners"
        subtitle="Create partner organizations, grant portal access by email, and revoke when needed. B2B users get wholesale margin rules."
      >
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Partners sign in at <code className="rounded bg-slate-100 px-1">/partner</code> with
            B2B rates from Pricing &amp; margins.
          </p>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700"
          >
            {showForm ? "Cancel" : "Add partner"}
          </button>
        </div>

        {showForm && (
          <form
            onSubmit={handleCreate}
            className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2"
          >
            <label className="block text-sm">
              <span className="font-semibold text-slate-700">Organization name</span>
              <input name="name" required className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" />
            </label>
            <label className="block text-sm">
              <span className="font-semibold text-slate-700">Company code</span>
              <input
                name="company_code"
                required
                placeholder="ACME-TRAVEL"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono uppercase"
              />
            </label>
            <label className="block text-sm">
              <span className="font-semibold text-slate-700">Contact email</span>
              <input name="contact_email" type="email" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="font-semibold text-slate-700">Notes</span>
              <textarea name="notes" rows={2} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" />
            </label>
            <button
              type="submit"
              disabled={creating}
              className="sm:col-span-2 rounded-lg bg-violet-600 py-2.5 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {creating ? "Creating…" : "Create partner"}
            </button>
          </form>
        )}

        <div className="mt-8 space-y-4">
          {loading ? (
            <p className="text-sm text-slate-400">Loading partners…</p>
          ) : partners.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 py-12 text-center">
              <PiBriefcaseFill className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-3 text-sm text-slate-500">No B2B partners yet. Add one to get started.</p>
            </div>
          ) : (
            partners.map((p) => (
              <PartnerCard
                key={p.id}
                partner={p}
                onGrant={grantAccess}
                onRevokeMember={revokeAccess}
                onRevokePartner={revokePartner}
                onDelete={deletePartner}
                onError={setError}
              />
            ))
          )}
        </div>
      </AdminShell>
    </AdminGate>
  );
}
