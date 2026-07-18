"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "../../auth/context";
import { 
  PiUserFill, 
  PiAirplaneTiltFill,
  PiMapPinFill,
  PiChatTeardropTextFill
} from "react-icons/pi";

export default function IndividualDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"trips" | "bookings" | "profile">("trips");

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white">
                <PiUserFill className="h-5 w-5" />
              </div>
              <span className="font-bold text-slate-900 text-lg tracking-tight">My Travel Dashboard</span>
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
                onClick={() => setActiveTab("trips")}
                className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all ${
                  activeTab === "trips" 
                    ? "bg-emerald-50 text-emerald-700" 
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <PiMapPinFill className="h-5 w-5" />
                Saved Trips
              </button>
              <button
                onClick={() => setActiveTab("bookings")}
                className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all ${
                  activeTab === "bookings" 
                    ? "bg-emerald-50 text-emerald-700" 
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <PiAirplaneTiltFill className="h-5 w-5" />
                My Bookings
              </button>
              <button
                onClick={() => setActiveTab("profile")}
                className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all ${
                  activeTab === "profile" 
                    ? "bg-emerald-50 text-emerald-700" 
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <PiUserFill className="h-5 w-5" />
                Profile & Settings
              </button>
            </nav>

            <div className="mt-8 p-5 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-2xl shadow-lg shadow-emerald-200 text-white">
              <h3 className="font-semibold text-white/90 mb-1">Where to next?</h3>
              <p className="text-xs text-white/70 mb-4">Chat with our AI assistant to plan your dream vacation.</p>
              <Link
                href="/chat"
                className="flex items-center justify-center gap-2 w-full bg-white text-emerald-600 py-2.5 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors"
              >
                <PiChatTeardropTextFill className="h-4 w-4" /> Start Planning
              </Link>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1">
            {activeTab === "trips" && (
              <div className="space-y-6 animate-fade-in">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold text-slate-900">Saved Trips</h2>
                  <Link href="/trips" className="text-sm font-semibold text-emerald-600 hover:text-emerald-700">
                    View all in Trips Tab &rarr;
                  </Link>
                </div>
                
                <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-sm">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 mb-4">
                    <PiMapPinFill className="h-6 w-6 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">No saved trips</h3>
                  <p className="text-slate-500 text-sm mt-1 mb-6">You haven't saved any itineraries yet.</p>
                </div>
              </div>
            )}

            {activeTab === "bookings" && (
              <div className="space-y-6 animate-fade-in">
                <h2 className="text-xl font-bold text-slate-900">My Bookings</h2>
                <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-sm">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 mb-4">
                    <PiAirplaneTiltFill className="h-6 w-6 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">No bookings yet</h3>
                  <p className="text-slate-500 text-sm mt-1 mb-6">Ready to travel? Let's find some flights or hotels.</p>
                  <Link href="/chat" className="inline-flex bg-emerald-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-700 shadow-sm transition-all hover:-translate-y-0.5">
                    Explore Destinations
                  </Link>
                </div>
              </div>
            )}

            {activeTab === "profile" && (
              <div className="space-y-6 animate-fade-in">
                <h2 className="text-xl font-bold text-slate-900">Profile & Settings</h2>
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="h-16 w-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
                      <PiUserFill className="h-8 w-8" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-lg">Traveler Profile</h3>
                      <p className="text-sm text-slate-500">{user?.email}</p>
                    </div>
                  </div>
                  
                  <div className="border-t border-slate-100 pt-6">
                    <button className="text-sm font-semibold text-red-600 hover:text-red-700">
                      Sign Out
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
