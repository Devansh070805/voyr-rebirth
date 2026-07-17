'use client';

import React, { useState } from 'react';

export default function AgentPortal() {
  const [showClientModal, setShowClientModal] = useState(false);

  return (
    <div className="space-y-8 animate-fade-in">
      <header className="flex items-center justify-between mb-12">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight">Agent Portal</h1>
          <p className="text-slate-500 mt-2">Manage clients, commissions, and master bookings.</p>
        </div>
        <button 
          onClick={() => setShowClientModal(true)}
          className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-slate-800 transition-colors"
        >
          + New Client
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Metrics Panels */}
        <div className="backdrop-blur-xl bg-white/40 border border-white/60 p-6 rounded-2xl shadow-sm">
          <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider">Active Clients</h3>
          <p className="text-4xl font-bold mt-2">142</p>
        </div>
        <div className="backdrop-blur-xl bg-white/40 border border-white/60 p-6 rounded-2xl shadow-sm">
          <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider">YTD Commissions</h3>
          <p className="text-4xl font-bold mt-2">$24,500</p>
        </div>
        <div className="backdrop-blur-xl bg-white/40 border border-white/60 p-6 rounded-2xl shadow-sm">
          <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider">Master Bookings</h3>
          <p className="text-4xl font-bold mt-2">89</p>
        </div>
      </div>

      {/* Client List */}
      <div className="backdrop-blur-xl bg-white/40 border border-white/60 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200/60 flex items-center justify-between">
          <h2 className="text-lg font-bold">Client Roster</h2>
          <input type="text" placeholder="Search clients..." className="text-sm px-4 py-2 rounded-lg border border-slate-200 bg-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-6 py-3 font-medium text-slate-500">Name</th>
                <th className="px-6 py-3 font-medium text-slate-500">Contact</th>
                <th className="px-6 py-3 font-medium text-slate-500">Passport Status</th>
                <th className="px-6 py-3 font-medium text-slate-500">Active Bookings</th>
                <th className="px-6 py-3 font-medium text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr className="hover:bg-white/40 transition-colors">
                <td className="px-6 py-4 font-medium">Alice Freeman</td>
                <td className="px-6 py-4 text-slate-600">alice@example.com<br/>+1 (555) 123-4567</td>
                <td className="px-6 py-4"><span className="px-2 py-1 bg-green-100 text-green-700 rounded-md text-xs font-medium">Verified</span></td>
                <td className="px-6 py-4">1 (Paris Getaway)</td>
                <td className="px-6 py-4"><button className="text-blue-600 hover:underline">View Profile</button></td>
              </tr>
              <tr className="hover:bg-white/40 transition-colors">
                <td className="px-6 py-4 font-medium">Michael Chang</td>
                <td className="px-6 py-4 text-slate-600">mike.c@example.com<br/>+1 (555) 987-6543</td>
                <td className="px-6 py-4"><span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-md text-xs font-medium">Pending Exp</span></td>
                <td className="px-6 py-4">0</td>
                <td className="px-6 py-4"><button className="text-blue-600 hover:underline">View Profile</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {showClientModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <h2 className="text-xl font-bold mb-4">Create Client Profile</h2>
            <div className="space-y-4">
              <input type="text" placeholder="Full Name" className="w-full px-4 py-2 rounded-lg border border-slate-200" />
              <input type="email" placeholder="Email Address" className="w-full px-4 py-2 rounded-lg border border-slate-200" />
              <input type="tel" placeholder="Phone Number" className="w-full px-4 py-2 rounded-lg border border-slate-200" />
              <textarea placeholder="Agent Notes (Preferences, etc.)" className="w-full px-4 py-2 rounded-lg border border-slate-200 h-24"></textarea>
            </div>
            <div className="mt-6 flex justify-end space-x-3">
              <button onClick={() => setShowClientModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
              <button onClick={() => setShowClientModal(false)} className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800">Save Client</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
