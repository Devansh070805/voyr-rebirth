'use client';

import React from 'react';

export default function CorporateDashboard() {
  return (
    <div className="space-y-8 animate-fade-in">
      <header className="mb-12 border-b border-slate-200 pb-6 flex justify-between items-end">
        <div>
          <p className="text-sm font-bold text-blue-600 uppercase tracking-widest mb-1">Acme Corp</p>
          <h1 className="text-4xl font-extrabold tracking-tight">Corporate Travel</h1>
        </div>
        <button className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-slate-800 transition-colors">
          Submit Travel Request
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Hierarchical Employee List */}
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-2xl font-bold">Employee Travel Activity</h2>
          <div className="backdrop-blur-xl bg-white/40 border border-white/60 rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/50">
                <tr>
                  <th className="px-6 py-3 font-medium text-slate-500">Employee</th>
                  <th className="px-6 py-3 font-medium text-slate-500">Department</th>
                  <th className="px-6 py-3 font-medium text-slate-500">Role</th>
                  <th className="px-6 py-3 font-medium text-slate-500">Latest Trip</th>
                  <th className="px-6 py-3 font-medium text-slate-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr className="hover:bg-white/40 transition-colors">
                  <td className="px-6 py-4 font-medium flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold">SJ</div>
                    <span>Sarah Jenkins</span>
                  </td>
                  <td className="px-6 py-4">Engineering</td>
                  <td className="px-6 py-4 text-slate-500">Senior Dev</td>
                  <td className="px-6 py-4">SF Tech Conference</td>
                  <td className="px-6 py-4"><span className="px-2 py-1 bg-green-100 text-green-700 rounded-md text-xs font-medium">Approved</span></td>
                </tr>
                <tr className="hover:bg-white/40 transition-colors">
                  <td className="px-6 py-4 font-medium flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">MR</div>
                    <span>Mark Robbins</span>
                  </td>
                  <td className="px-6 py-4">Sales</td>
                  <td className="px-6 py-4 text-slate-500">Regional Director</td>
                  <td className="px-6 py-4">London Q3 Pitch</td>
                  <td className="px-6 py-4"><span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-md text-xs font-medium">Pending Manager</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Company Profile Sidebar */}
        <div className="space-y-6">
          <div className="backdrop-blur-xl bg-white/40 border border-white/60 p-6 rounded-2xl shadow-sm">
            <h3 className="text-lg font-bold mb-4">Company Profile</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Billing Account</span>
                <span className="font-medium">ACME-88392</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Monthly Budget</span>
                <span className="font-medium">$50,000</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Spent MTD</span>
                <span className="font-medium text-red-600">$32,450</span>
              </div>
              <div className="pt-4 mt-4 border-t border-slate-200">
                <button className="w-full text-center text-blue-600 font-medium hover:underline">Manage Settings</button>
              </div>
            </div>
          </div>

          <div className="backdrop-blur-xl bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 rounded-2xl shadow-lg">
            <h3 className="text-lg font-bold mb-2">Pending Approvals</h3>
            <p className="text-sm text-slate-300 mb-4">You have 3 travel requests waiting for your authorization.</p>
            <button className="w-full bg-white text-slate-900 py-2 rounded-lg font-medium text-sm hover:bg-slate-100 transition-colors">Review Requests</button>
          </div>
        </div>
      </div>
    </div>
  );
}
