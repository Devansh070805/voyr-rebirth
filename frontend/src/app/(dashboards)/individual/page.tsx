'use client';

import React from 'react';

export default function IndividualDashboard() {
  const downloadItinerary = () => {
    // Mock client-side download PDF function
    alert('Downloading PDF itinerary...');
  };

  const shareItinerary = () => {
    // Mock share link
    navigator.clipboard.writeText('https://voyr.com/trip/123');
    alert('Share link copied to clipboard!');
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <header className="mb-12">
        <h1 className="text-4xl font-extrabold tracking-tight">Your Journeys</h1>
        <p className="text-slate-500 mt-2">Manage your saved trips, itineraries, and inquiries.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Glassmorphism Card */}
        <div className="backdrop-blur-xl bg-white/40 border border-white/60 p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
          <div className="h-40 bg-slate-200 rounded-xl mb-4 overflow-hidden">
            {/* Mapbox/Three.js placeholder */}
            <div className="w-full h-full bg-gradient-to-br from-blue-100 to-slate-200 flex items-center justify-center text-slate-400 font-medium">Map View</div>
          </div>
          <h2 className="text-xl font-bold">Kyoto Autumn Escape</h2>
          <p className="text-sm text-slate-500 mt-1">Auto-Generated Itinerary</p>
          <div className="mt-4 flex space-x-3">
            <button onClick={downloadItinerary} className="text-xs px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors">Download</button>
            <button onClick={shareItinerary} className="text-xs px-4 py-2 bg-white text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">Share</button>
          </div>
        </div>

        {/* Master Profile Card */}
        <div className="backdrop-blur-xl bg-white/40 border border-white/60 p-6 rounded-2xl shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-xl font-bold">Master Profile</h2>
            <ul className="mt-4 space-y-2 text-sm">
              <li className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500">Name</span>
                <span className="font-medium">John Doe</span>
              </li>
              <li className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500">Preferences</span>
                <span className="font-medium">Window Seat, Vegetarian</span>
              </li>
              <li className="flex justify-between pb-2">
                <span className="text-slate-500">Inquiries</span>
                <span className="font-medium">2 Active</span>
              </li>
            </ul>
          </div>
          <button className="mt-6 w-full text-xs px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">Edit Profile</button>
        </div>
      </div>
    </div>
  );
}
