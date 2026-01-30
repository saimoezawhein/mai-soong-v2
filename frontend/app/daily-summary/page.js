'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function DailySummaryPage() {
  const searchParams = useSearchParams();
  const [summaries, setSummaries] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSupplier, setSelectedSupplier] = useState(searchParams.get('supplier_id') || '');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    fetchSuppliers();
    fetchSummaries();
  }, [selectedSupplier, startDate, endDate]);

  const fetchSuppliers = async () => {
    try {
      const res = await fetch(`${API_URL}/suppliers`);
      const data = await res.json();
      setSuppliers(data);
    } catch (err) {
      console.error('Failed to fetch suppliers:', err);
    }
  };

  const fetchSummaries = async () => {
    try {
      let url = `${API_URL}/daily-summary?`;
      if (selectedSupplier) url += `supplier_id=${selectedSupplier}&`;
      if (startDate) url += `start_date=${startDate}&`;
      if (endDate) url += `end_date=${endDate}&`;

      const res = await fetch(url);
      const data = await res.json();
      setSummaries(data);
    } catch (err) {
      console.error('Failed to fetch summaries:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num, decimals = 2) => {
    return Number(num || 0).toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-GB', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  // Calculate totals
  const totals = summaries.reduce((acc, s) => ({
    opening: acc.opening + Number(s.opening_thb),
    purchased: acc.purchased + Number(s.purchased_thb),
    sold: acc.sold + Number(s.sold_thb),
    closing: acc.closing + Number(s.closing_thb),
    profit: acc.profit + Number(s.daily_profit_thb),
  }), { opening: 0, purchased: 0, sold: 0, closing: 0, profit: 0 });

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">
          <i className="fa-regular fa-calendar"></i> Daily Summary
        </h1>
        <a
          href={`${API_URL}/export/daily/${new Date().toISOString().slice(0, 10)}`}
          className="btn btn-success"
        >
          <i className="fa-regular fa-file-code mr-2"></i> Export Today
        </a>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="label">Supplier</label>
            <select
              className="input"
              value={selectedSupplier}
              onChange={(e) => setSelectedSupplier(e.target.value)}
            >
              <option value="">All Suppliers</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Start Date</label>
            <input
              type="date"
              className="input"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <label className="label">End Date</label>
            <input
              type="date"
              className="input"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                setSelectedSupplier('');
                setStartDate('');
                setEndDate('');
              }}
              className="btn btn-ghost w-full"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="stat-card">
          <div className="stat-label">Total Opening</div>
          <div className="stat-value text-gray-600">{formatNumber(totals.opening)}</div>
        </div>
        <div className="stat-card bg-emerald-50">
          <div className="stat-label">Total Purchased</div>
          <div className="stat-value text-emerald-600">+{formatNumber(totals.purchased)}</div>
        </div>
        <div className="stat-card bg-blue-50">
          <div className="stat-label">Total Sold</div>
          <div className="stat-value text-blue-600">-{formatNumber(totals.sold)}</div>
        </div>
        <div className="stat-card bg-amber-50">
          <div className="stat-label">Total Closing</div>
          <div className="stat-value text-amber-600">{formatNumber(totals.closing)}</div>
        </div>
        <div className={`stat-card ${totals.profit >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
          <div className="stat-label">Total Profit</div>
          <div className={`stat-value ${totals.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {totals.profit >= 0 ? '+' : ''}{formatNumber(totals.profit)}
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent mx-auto"></div>
        </div>
      ) : summaries.length === 0 ? (
        <div className="card text-center py-16">
          <div className="text-6xl mb-4"><i className="fa-solid fa-calendar-days"></i></div>
          <h3 className="text-xl text-gray-600">No data found</h3>
          <p className="text-gray-500">Try adjusting your filters</p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Supplier</th>
                  <th>Opening</th>
                  <th>Purchased</th>
                  <th>Sold</th>
                  <th>Closing</th>
                  <th>Avg Rate</th>
                  <th>Profit</th>
                </tr>
              </thead>
              <tbody>
                {summaries.map((s) => (
                  <tr key={s.id}>
                    <td className="font-medium">{formatDate(s.summary_date)}</td>
                    <td>{s.supplier_name}</td>
                    <td>{formatNumber(s.opening_thb)}</td>
                    <td className="text-emerald-600">+{formatNumber(s.purchased_thb)}</td>
                    <td className="text-blue-600">-{formatNumber(s.sold_thb)}</td>
                    <td className="font-semibold">{formatNumber(s.closing_thb)}</td>
                    <td>{formatNumber(s.closing_avg_rate, 4)}</td>
                    <td className={`font-semibold ${s.daily_profit_thb >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {s.daily_profit_thb >= 0 ? '+' : ''}{formatNumber(s.daily_profit_thb)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
