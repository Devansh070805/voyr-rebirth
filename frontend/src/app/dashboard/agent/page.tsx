"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "../../auth/context";
import { 
  PiUsersFill, 
  PiWalletFill, 
  PiSuitcaseRollingFill, 
  PiPlusBold,
  PiAirplaneTiltFill,
  PiTrendUpFill,
  PiChatTeardropTextFill
} from "react-icons/pi";

export default function AgentDashboard() {
  const { user, apiFetch } = useAuth();
  const [activeTab, setActiveTab] = useState<"clients" | "bookings" | "wallet">("clients");
  const [clients, setClients] = useState<any[]>([]);
  const [wallet, setWallet] = useState<any>(null);
  
  const [showAddClient, setShowAddClient] = useState(false);
  const [newClient, setNewClient] = useState({ name: "", email: "", phone: "", travel_preference: "", passport_details: "", notes: "" });

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch("/accounts/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newClient)
      });
      if (res.ok) {
        const data = await res.json();
        setClients([data.client, ...clients]);
        setShowAddClient(false);
        setNewClient({ name: "", email: "", phone: "", travel_preference: "", passport_details: "", notes: "" });
      } else {
        console.error("Failed to add client");
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (activeTab === "clients") {
      apiFetch("/accounts/clients")
        .then(res => res.json())
        .then(data => setClients(data.clients || []))
        .catch(console.error);
    } else if (activeTab === "wallet") {
      apiFetch("/accounts/wallet")
        .then(res => res.json())
        .then(data => setWallet(data.wallet || { balance: 0, currency: 'USD' }))
        .catch(console.error);
    }
  }, [activeTab, apiFetch]);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-violet-600 flex items-center justify-center text-white">
                <PiSuitcaseRollingFill className="h-5 w-5" />
              </div>
              <span className="font-bold text-slate-900 text-lg tracking-tight">Travel Agent Portal</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-slate-600">{user?.email}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row gap-8">
          
          {/* Sidebar */}
          <div className="w-full md:w-64 shrink-0">
            <nav className="flex flex-col gap-1">
              <button
                onClick={() => setActiveTab("clients")}
                className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all ${
                  activeTab === "clients" 
                    ? "bg-violet-50 text-violet-700" 
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <PiUsersFill className="h-5 w-5" />
                My Clients
              </button>
              <button
                onClick={() => setActiveTab("bookings")}
                className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all ${
                  activeTab === "bookings" 
                    ? "bg-violet-50 text-violet-700" 
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <PiAirplaneTiltFill className="h-5 w-5" />
                Bookings
              </button>
              <button
                onClick={() => setActiveTab("wallet")}
                className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all ${
                  activeTab === "wallet" 
                    ? "bg-violet-50 text-violet-700" 
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <PiWalletFill className="h-5 w-5" />
                Wallet & Commissions
              </button>
            </nav>

            <div className="mt-8 p-5 bg-gradient-to-br from-violet-600 to-fuchsia-600 rounded-2xl shadow-lg shadow-violet-200 text-white">
              <h3 className="font-semibold text-white/90 mb-1">Plan a New Trip</h3>
              <p className="text-xs text-white/70 mb-4">Launch the AI assistant to plan and book for a client.</p>
              <Link
                href="/chat"
                className="flex items-center justify-center gap-2 w-full bg-white text-violet-600 py-2.5 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors"
              >
                <PiChatTeardropTextFill className="h-4 w-4" /> Start Planning
              </Link>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1">
            {activeTab === "clients" && (
              <div className="space-y-6 animate-fade-in">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold text-slate-900">My Clients</h2>
                  <button 
                    onClick={() => setShowAddClient(true)}
                    className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors shadow-sm"
                  >
                    <PiPlusBold /> Add Client
                  </button>
                </div>
                
                {/* Client List */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {clients.map((client, idx) => (
                    <div key={client.id || idx} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow group">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="font-bold text-slate-900">{client.name}</h3>
                          <p className="text-sm text-slate-500">{client.email}</p>
                          <p className="text-xs text-slate-400 mt-1">{client.phone}</p>
                        </div>
                        <div className="bg-violet-50 text-violet-700 text-xs font-bold px-2.5 py-1 rounded-lg">
                          0 Trips
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => {
                            localStorage.setItem('voyr_active_client', JSON.stringify(client));
                            window.location.href = '/chat';
                          }}
                          className="flex-1 text-center bg-slate-50 border border-slate-200 text-slate-700 py-2 rounded-xl text-sm font-medium hover:bg-slate-100 transition-colors"
                        >
                          Book Trip
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "wallet" && (
              <div className="space-y-6 animate-fade-in">
                <h2 className="text-xl font-bold text-slate-900">Wallet & Commissions</h2>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-lg shadow-slate-200 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-6 opacity-20">
                      <PiWalletFill className="h-24 w-24" />
                    </div>
                    <p className="text-slate-400 text-sm font-medium">Available Balance</p>
                    <h3 className="text-4xl font-bold mt-2">
                      {wallet ? `${wallet.balance} ${wallet.currency}` : "$0.00"}
                    </h3>
                    <div className="mt-8 flex gap-3">
                      <button className="bg-white text-slate-900 px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-50">
                        Add Funds
                      </button>
                    </div>
                  </div>
                  
                  <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl">
                        <PiTrendUpFill className="h-5 w-5" />
                      </div>
                      <p className="text-slate-500 text-sm font-medium">Pending Commissions</p>
                    </div>
                    <h3 className="text-3xl font-bold text-slate-900">$320.00</h3>
                    <p className="text-xs text-slate-400 mt-4">From 2 upcoming bookings</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "bookings" && (
              <div className="space-y-6 animate-fade-in">
                <h2 className="text-xl font-bold text-slate-900">Recent Bookings</h2>
                <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-sm">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 mb-4">
                    <PiAirplaneTiltFill className="h-6 w-6 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">No bookings yet</h3>
                  <p className="text-slate-500 text-sm mt-1 mb-6">Start planning a trip for your clients.</p>
                  <Link href="/chat" className="inline-flex bg-violet-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-violet-700 shadow-sm transition-all hover:-translate-y-0.5">
                    Plan a Trip
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Add Client Modal */}
      {showAddClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 animate-fade-in shadow-xl">
            <h2 className="text-xl font-bold text-slate-900 mb-6">Add New Client</h2>
            <form onSubmit={handleAddClient} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <input required value={newClient.name} onChange={e => setNewClient({...newClient, name: e.target.value})} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500" placeholder="John Doe" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input type="email" required value={newClient.email} onChange={e => setNewClient({...newClient, email: e.target.value})} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500" placeholder="john@example.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                <input value={newClient.phone} onChange={e => setNewClient({...newClient, phone: e.target.value})} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500" placeholder="+1 234 567 8900" />
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => setShowAddClient(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900">Cancel</button>
                <button type="submit" className="bg-violet-600 text-white px-6 py-2 rounded-xl text-sm font-bold hover:bg-violet-700 shadow-sm transition-all">Save Client</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
