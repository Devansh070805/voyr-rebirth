import React from 'react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <nav className="fixed top-0 left-0 right-0 h-16 z-50 backdrop-blur-md bg-white/60 border-b border-white/20 shadow-sm flex items-center px-8">
        <div className="text-xl font-bold tracking-tighter">VOYR.</div>
        <div className="ml-auto flex space-x-6 text-sm font-medium">
          <button className="hover:text-blue-600 transition-colors">Profile</button>
          <button className="hover:text-blue-600 transition-colors">Settings</button>
          <button className="hover:text-blue-600 transition-colors">Logout</button>
        </div>
      </nav>
      <main className="pt-24 pb-12 px-8 max-w-7xl mx-auto">
        {children}
      </main>
    </div>
  );
}
