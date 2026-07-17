'use client';

import React from 'react';

export default function AdminDashboard() {
  return (
    <div className="space-y-8 animate-fade-in">
      <header className="mb-8">
        <h1 className="text-4xl font-extrabold tracking-tight">Platform Admin</h1>
        <p className="text-slate-500 mt-2">Supervise all users, supplier configurations, and system pipelines.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Verification Gates */}
        <div className="backdrop-blur-xl bg-white/40 border border-white/60 p-6 rounded-2xl shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">Verification Gates</h2>
            <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold">5 Action Required</span>
          </div>
          
          <div className="space-y-4">
            <div className="p-4 border border-slate-200 rounded-xl bg-white/50">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-bold text-sm">Agent Credential Review</h4>
                  <p className="text-xs text-slate-500 mt-1">David Smith (TravelCo Inc)</p>
                </div>
                <div className="flex space-x-2">
                  <button className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700">Approve</button>
                  <button className="px-3 py-1.5 bg-slate-200 text-slate-700 text-xs rounded-lg hover:bg-slate-300">Reject</button>
                </div>
              </div>
            </div>

            <div className="p-4 border border-slate-200 rounded-xl bg-white/50">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-bold text-sm">Corporate Onboarding</h4>
                  <p className="text-xs text-slate-500 mt-1">Stark Industries (Billing Setup)</p>
                </div>
                <div className="flex space-x-2">
                  <button className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700">Approve</button>
                  <button className="px-3 py-1.5 bg-slate-200 text-slate-700 text-xs rounded-lg hover:bg-slate-300">Reject</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* System & API Status */}
        <div className="backdrop-blur-xl bg-white/40 border border-white/60 p-6 rounded-2xl shadow-sm">
          <h2 className="text-xl font-bold mb-6">Supplier Connections</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg hover:bg-white/50 transition-colors">
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span className="font-medium text-sm">Geoapify (Geocoding)</span>
              </div>
              <span className="text-xs text-slate-500">99.9% Uptime</span>
            </div>
            
            <div className="flex items-center justify-between p-3 rounded-lg hover:bg-white/50 transition-colors">
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span className="font-medium text-sm">Makcorps (Hotel Inventory)</span>
              </div>
              <span className="text-xs text-slate-500">Syncing...</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg hover:bg-white/50 transition-colors">
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                <span className="font-medium text-sm">Aviation Stack (Flights)</span>
              </div>
              <span className="text-xs text-slate-500">Rate Limited</span>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-slate-200">
            <button className="w-full bg-slate-900 text-white py-2 rounded-lg font-medium text-sm hover:bg-slate-800 transition-colors">Manage API Keys</button>
          </div>
        </div>
      </div>
    </div>
  );
}
