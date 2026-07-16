"use client";



import { useState } from "react";

import {

  PiWarningFill,

  PiCheckCircleFill,

  PiMoneyFill,

  PiFileXFill,

  PiTruckFill,

  PiArrowCounterClockwiseFill,

  PiPackageFill,

} from "react-icons/pi";

import AdminGate from "../../components/admin/AdminGate";

import AdminShell from "../../components/admin/AdminShell";

import { useAuth } from "../../auth/context";

import { useAdminList } from "../../hooks/useAdminList";

import {

  type OpsTab,

  type OpsRow,

  type OpsBookingRow,

  isOpsPaymentRow,

  isOpsQuoteRow,

  isOpsDocumentJobRow,

  isOpsFulfillmentRow,

} from "./types";



const TABS: { key: OpsTab; label: string; icon: React.ReactNode }[] = [

  { key: "active-bookings", label: "Active bookings", icon: <PiCheckCircleFill /> },

  { key: "failed-payments", label: "Failed payments", icon: <PiMoneyFill /> },

  { key: "expired-quotes", label: "Expired quotes", icon: <PiWarningFill /> },

  { key: "supplier-pending", label: "Supplier pending", icon: <PiTruckFill /> },

  { key: "fulfillments", label: "Fulfillments", icon: <PiPackageFill /> },

  { key: "document-failures", label: "Document failures", icon: <PiFileXFill /> },

  { key: "refund-requests", label: "Refund requests", icon: <PiArrowCounterClockwiseFill /> },

];



function relatedId(tab: OpsTab, row: OpsRow): string {

  if (isOpsFulfillmentRow(row)) return row.booking_id;

  if (isOpsPaymentRow(row)) return row.quote_id;

  if (isOpsQuoteRow(row)) return row.package_id;

  if (isOpsDocumentJobRow(row)) return row.booking_id;

  return (row as OpsBookingRow).quote_id;

}



export default function AdminOpsPage() {

  const { adminFetch } = useAuth();

  const [tab, setTab] = useState<OpsTab>("active-bookings");

  const { data: rows, loading, error, reload, setError } = useAdminList<OpsRow>(`/admin/${tab}`);



  const confirmFulfillment = async (id: string) => {

    const res = await adminFetch(`/admin/fulfillments/${id}`, {

      method: "PATCH",

      headers: { "Content-Type": "application/json" },

      body: JSON.stringify({ fulfillment_status: "confirmed" }),

    });

    if (!res.ok) throw new Error("Failed to confirm fulfillment");

    reload();

  };



  return (

    <AdminGate>

      <AdminShell

        section="ops"

        title="Admin operations"

        subtitle="Monitor payments, quotes, confirmed bookings, fulfillments, and document failures."

      >

        <div className="mt-6 flex flex-wrap gap-2">

          {TABS.map((t) => (

            <button

              key={t.key}

              type="button"

              onClick={() => {

                setError(null);

                setTab(t.key);

              }}

              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition ${

                tab === t.key

                  ? "bg-violet-600 text-white shadow-md"

                  : "border border-slate-200 bg-white text-slate-600 hover:border-violet-200"

              }`}

            >

              {t.icon}

              {t.label}

            </button>

          ))}

          <button

            type="button"

            onClick={() => reload()}

            className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"

          >

            Refresh

          </button>

        </div>



        {error && (

          <p className="mt-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>

        )}



        {loading ? (

          <p className="mt-8 text-sm text-slate-400">Loading…</p>

        ) : rows.length === 0 ? (

          <p className="mt-8 text-sm text-slate-400">No items in this queue.</p>

        ) : (

          <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">

            <table className="w-full text-sm">

              <thead>

                <tr className="border-b border-slate-200 bg-slate-50 text-left">

                  <th className="px-4 py-3 font-bold">ID</th>

                  {tab === "failed-payments" && <th className="px-4 py-3 font-bold">Amount</th>}

                  {tab === "fulfillments" && (

                    <>

                      <th className="px-4 py-3 font-bold">Product</th>

                      <th className="px-4 py-3 font-bold">Amount</th>

                    </>

                  )}

                  <th className="px-4 py-3 font-bold">Status</th>

                  <th className="px-4 py-3 font-bold">Related</th>

                  {tab === "fulfillments" && <th className="px-4 py-3 font-bold">Action</th>}

                </tr>

              </thead>

              <tbody>

                {rows.map((row) => (

                  <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50">

                    <td className="px-4 py-3 font-mono text-xs">{row.id.slice(0, 8)}…</td>

                    {tab === "failed-payments" && isOpsPaymentRow(row) && (

                      <td className="px-4 py-3">{row.amount}</td>

                    )}

                    {tab === "fulfillments" && isOpsFulfillmentRow(row) && (

                      <>

                        <td className="px-4 py-3">

                          <span className="text-xs text-slate-500">{row.supply_source}</span>

                          <div className="font-medium">{row.supply_product}</div>

                        </td>

                        <td className="px-4 py-3">

                          {row.currency} {row.sell_amount}

                        </td>

                      </>

                    )}

                    <td className="px-4 py-3">

                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold">

                        {isOpsFulfillmentRow(row) ? row.fulfillment_status : row.status}

                      </span>

                    </td>

                    <td className="px-4 py-3 font-mono text-xs text-slate-500">

                      {relatedId(tab, row).slice(0, 8)}…

                    </td>

                    {tab === "fulfillments" && isOpsFulfillmentRow(row) && (

                      <td className="px-4 py-3">

                        {row.fulfillment_status !== "confirmed" && (

                          <button

                            type="button"

                            onClick={async () => {

                              try {

                                await confirmFulfillment(row.id);

                              } catch (e) {

                                setError(e instanceof Error ? e.message : "Confirm failed");

                              }

                            }}

                            className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-700"

                          >

                            Confirm

                          </button>

                        )}

                      </td>

                    )}

                  </tr>

                ))}

              </tbody>

            </table>

          </div>

        )}

      </AdminShell>

    </AdminGate>

  );

}

