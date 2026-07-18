"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "../../auth/context";
import { 
  PiUsersFill, 
  PiBuildingsFill, 
  PiPlusBold,
  PiAirplaneTiltFill,
  PiReceiptFill,
  PiChatTeardropTextFill
} from "react-icons/pi";

export default function CorporateDashboard() {
  const { user, apiFetch } = useAuth();
  const [activeTab, setActiveTab] = useState<"employees" | "bookings" | "invoices">("employees");
  const [employees, setEmployees] = useState<any[]>([]);

  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [newEmployee, setNewEmployee] = useState({ name: "", email: "", department: "", role: "" });

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch("/accounts/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newEmployee)
      });
      if (res.ok) {
        const data = await res.json();
        setEmployees([data.employee, ...employees]);
        setShowAddEmployee(false);
        setNewEmployee({ name: "", email: "", department: "", role: "" });
      } else {
        console.error("Failed to add employee");
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (activeTab === "employees") {
      apiFetch("/accounts/employees")
        .then(res => res.json())
        .then(data => setEmployees(data.employees || []))
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
              <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
                <PiBuildingsFill className="h-5 w-5" />
              </div>
              <span className="font-bold text-slate-900 text-lg tracking-tight">Corporate Travel</span>
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
                onClick={() => setActiveTab("employees")}
                className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all ${
                  activeTab === "employees" 
                    ? "bg-blue-50 text-blue-700" 
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <PiUsersFill className="h-5 w-5" />
                Employees
              </button>
              <button
                onClick={() => setActiveTab("bookings")}
                className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all ${
                  activeTab === "bookings" 
                    ? "bg-blue-50 text-blue-700" 
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <PiAirplaneTiltFill className="h-5 w-5" />
                Travel History
              </button>
              <button
                onClick={() => setActiveTab("invoices")}
                className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all ${
                  activeTab === "invoices" 
                    ? "bg-blue-50 text-blue-700" 
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <PiReceiptFill className="h-5 w-5" />
                Invoices & Payables
              </button>
            </nav>

            <div className="mt-8 p-5 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl shadow-lg shadow-blue-200 text-white">
              <h3 className="font-semibold text-white/90 mb-1">Book Travel</h3>
              <p className="text-xs text-white/70 mb-4">Launch the AI assistant to book flights or hotels for an employee.</p>
              <Link
                href="/chat"
                className="flex items-center justify-center gap-2 w-full bg-white text-blue-600 py-2.5 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors"
              >
                <PiChatTeardropTextFill className="h-4 w-4" /> Start Booking
              </Link>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1">
            {activeTab === "employees" && (
              <div className="space-y-6 animate-fade-in">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold text-slate-900">Employees</h2>
                  <button 
                    onClick={() => setShowAddEmployee(true)}
                    className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors shadow-sm"
                  >
                    <PiPlusBold /> Add Employee
                  </button>
                </div>
                
                {/* Employee List */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {employees.map((emp, idx) => (
                    <div key={emp.id || idx} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-bold text-slate-900">{emp.name}</h3>
                          <p className="text-sm text-slate-500">{emp.email}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <span className="bg-slate-100 text-slate-600 text-xs font-medium px-2 py-1 rounded-md">
                          {emp.department || "No Dept"}
                        </span>
                        <span className="bg-blue-50 text-blue-600 text-xs font-medium px-2 py-1 rounded-md">
                          {emp.role || "Employee"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "invoices" && (
              <div className="space-y-6 animate-fade-in">
                <h2 className="text-xl font-bold text-slate-900">Invoices & Payables</h2>
                <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-sm">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 mb-4">
                    <PiReceiptFill className="h-6 w-6 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">No invoices yet</h3>
                  <p className="text-slate-500 text-sm mt-1 mb-6">Corporate invoices will appear here once bookings are made.</p>
                </div>
              </div>
            )}

            {activeTab === "bookings" && (
              <div className="space-y-6 animate-fade-in">
                <h2 className="text-xl font-bold text-slate-900">Travel History</h2>
                <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-sm">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 mb-4">
                    <PiAirplaneTiltFill className="h-6 w-6 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">No travel history</h3>
                  <p className="text-slate-500 text-sm mt-1 mb-6">Start planning a trip for your employees.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Add Employee Modal */}
      {showAddEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 animate-fade-in shadow-xl">
            <h2 className="text-xl font-bold text-slate-900 mb-6">Add New Employee</h2>
            <form onSubmit={handleAddEmployee} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <input required value={newEmployee.name} onChange={e => setNewEmployee({...newEmployee, name: e.target.value})} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="Alice Chen" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input type="email" required value={newEmployee.email} onChange={e => setNewEmployee({...newEmployee, email: e.target.value})} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="alice@company.com" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
                  <input value={newEmployee.department} onChange={e => setNewEmployee({...newEmployee, department: e.target.value})} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="Engineering" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                  <input value={newEmployee.role} onChange={e => setNewEmployee({...newEmployee, role: e.target.value})} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="Developer" />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => setShowAddEmployee(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900">Cancel</button>
                <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-xl text-sm font-bold hover:bg-blue-700 shadow-sm transition-all">Save Employee</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
