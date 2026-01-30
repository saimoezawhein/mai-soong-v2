'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function DashboardPage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState([]);
  const [todaySummary, setTodaySummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierAlert, setNewSupplierAlert] = useState('10000');
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setCurrentUser(JSON.parse(storedUser));
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchData();
    }
  }, [currentUser]);

  const fetchData = async () => {
    try {
      const [suppliersRes, summaryRes] = await Promise.all([
        fetch(`${API_URL}/suppliers/dashboard?user_id=${currentUser?.id || 1}`),
        fetch(`${API_URL}/daily-summary/today`),
      ]);

      const suppliersData = await suppliersRes.json();
      const summaryData = await summaryRes.json();

      // Handle error responses - ensure suppliers is always an array
      setSuppliers(Array.isArray(suppliersData) ? suppliersData : []);
      setTodaySummary(summaryData.error ? null : summaryData);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSupplier = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/suppliers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newSupplierName,
          low_balance_alert: parseFloat(newSupplierAlert),
        }),
      });

      if (res.ok) {
        setShowAddModal(false);
        setNewSupplierName('');
        setNewSupplierAlert('10000');
        fetchData();
      }
    } catch (err) {
      console.error('Failed to add supplier:', err);
    }
  };

  const handleDeleteSupplier = async (id, name) => {
    if (!confirm(`Are you sure you want to delete "${name}"?\n\nThis will also delete all purchases and sales for this supplier.`)) {
      return;
    }
    
    try {
      const res = await fetch(`${API_URL}/suppliers/${id}`, {
        method: 'DELETE',
      });
      
      if (res.ok) {
        fetchData();
      } else {
        const data = await res.json();
        alert('Error: ' + (data.error || 'Failed to delete supplier'));
      }
    } catch (err) {
      console.error('Failed to delete supplier:', err);
      alert('Failed to delete supplier: ' + err.message);
    }
  };

  const formatNumber = (num, decimals = 2) => {
    return Number(num || 0).toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent mx-auto"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Today's Overview */}
      {todaySummary && (
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-800 pb-6"><i className="fa-regular fa-calendar-check mr-2"></i> Today&apos;s Overview</h1>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="stat-card">
              <div className="stat-label">Opening Balance</div>
              <div className="stat-value text-gray-600">
                {formatNumber(todaySummary.totals?.total_opening_thb)} <span className="text-sm font-normal">THB</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total Purchased</div>
              <div className="stat-value text-emerald-600">
                +{formatNumber(todaySummary.totals?.total_purchased_thb)} <span className="text-sm font-normal">THB</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total Sold</div>
              <div className="stat-value text-blue-600">
                -{formatNumber(todaySummary.totals?.total_sold_thb)} <span className="text-sm font-normal">THB</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Closing Balance</div>
              <div className="stat-value text-gray-800">
                {formatNumber(todaySummary.totals?.total_closing_thb)} <span className="text-sm font-normal">THB</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Today&apos;s Profit</div>
              <div className={`stat-value ${todaySummary.totals?.total_profit_thb >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {todaySummary.totals?.total_profit_thb >= 0 ? '+' : ''}
                {formatNumber(todaySummary.totals?.total_profit_thb)} <span className="text-sm font-normal">THB</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Suppliers Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-800"><i className="fa-regular fa-user"></i> Suppliers</h2>
        <button onClick={() => setShowAddModal(true)} className="btn btn-gradient">
          + Add Supplier
        </button>
      </div>

      {/* Suppliers Grid */}
      {suppliers.length === 0 ? (
        <div className="card text-center py-16">
          <div className="text-6xl mb-4"><i className="fa-solid fa-briefcase"></i></div>
          <h3 className="text-xl font-medium text-gray-600 mb-2">No suppliers yet</h3>
          <p className="text-gray-500 mb-6">Add your first supplier to get started</p>
          <button onClick={() => setShowAddModal(true)} className="btn btn-gradient">
            + Add Supplier
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {suppliers.map((supplier) => (
            <div
              key={supplier.id}
              className={`card-hover overflow-hidden ${
                supplier.low_balance_alert ? 'ring-2 ring-red-500' : ''
              }`}
            >
              {/* Header */}
              <div className={`-mx-6 -mt-6 px-6 py-4 mb-4 ${
                supplier.low_balance_alert ? 'bg-red-500' : 'header-gradient'
              } text-white`}>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">{supplier.name}</h3>
                  {supplier.low_balance_alert && (
                    <span className="text-xs bg-white/20 px-2 py-1 rounded-full">
                      <i className="fa-solid fa-triangle-exclamation mr-1"></i> Low Balance
                    </span>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-xs text-gray-500 mb-1">Opening</div>
                  <div className="font-semibold text-gray-700">{formatNumber(supplier.opening_thb)}</div>
                </div>
                <div className="text-center p-3 bg-emerald-50 rounded-lg">
                  <div className="text-xs text-emerald-600 mb-1">Purchased</div>
                  <div className="font-semibold text-emerald-700">+{formatNumber(supplier.purchased_thb)}</div>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <div className="text-xs text-blue-600 mb-1">Sold</div>
                  <div className="font-semibold text-blue-700">-{formatNumber(supplier.sold_thb)}</div>
                </div>
                <div className="text-center p-3 bg-amber-50 rounded-lg">
                  <div className="text-xs text-amber-600 mb-1">Balance</div>
                  <div className="font-semibold text-amber-700">{formatNumber(supplier.closing_thb)}</div>
                </div>
              </div>

              {/* Profit */}
              <div className={`text-center p-3 rounded-lg mb-4 ${
                supplier.daily_profit_thb >= 0 ? 'bg-emerald-50' : 'bg-red-50'
              }`}>
                <div className="text-xs text-gray-500 mb-1">Today&apos;s Profit</div>
                <div className={`text-xl font-bold ${
                  supplier.daily_profit_thb >= 0 ? 'text-emerald-600' : 'text-red-600'
                }`}>
                  {supplier.daily_profit_thb >= 0 ? '+' : ''}{formatNumber(supplier.daily_profit_thb)} THB
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Link href={`/supplier/${supplier.id}`} className="btn btn-primary flex-1">
                  Manage
                </Link>
                <Link href={`/daily-summary?supplier_id=${supplier.id}`} className="btn btn-outline">
                  History
                </Link>
                <button 
                  onClick={() => handleDeleteSupplier(supplier.id, supplier.name)}
                  className="btn btn-danger"
                  title="Delete Supplier"
                >
                  <i className="fa-regular fa-trash-can"></i>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Supplier Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-semibold text-gray-800 mb-6">Add Supplier</h2>
            <form onSubmit={handleAddSupplier}>
              <div className="mb-4">
                <label className="label">Supplier Name</label>
                <input
                  type="text"
                  className="input"
                  value={newSupplierName}
                  onChange={(e) => setNewSupplierName(e.target.value)}
                  placeholder="e.g., Main Counter"
                  required
                  autoFocus
                />
              </div>
              <div className="mb-6">
                <label className="label">Low Balance Alert (THB)</label>
                <input
                  type="number"
                  className="input"
                  value={newSupplierAlert}
                  onChange={(e) => setNewSupplierAlert(e.target.value)}
                  placeholder="10000"
                />
                <p className="text-xs text-gray-500 mt-1">
                  You&apos;ll be notified when balance drops below this amount
                </p>
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn btn-ghost"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-gradient">
                  Add Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}