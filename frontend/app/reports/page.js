'use client';

import { useEffect, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function ReportsPage() {
  const [reports, setReports] = useState({ data: [], totals: {} });
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    fetchSuppliers();
  }, []);

  useEffect(() => {
    fetchReports();
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

  const fetchReports = async () => {
    try {
      let url = `${API_URL}/reports/profit?`;
      if (selectedSupplier) url += `supplier_id=${selectedSupplier}&`;
      if (startDate) url += `start_date=${startDate}&`;
      if (endDate) url += `end_date=${endDate}&`;

      const res = await fetch(url);
      const data = await res.json();
      setReports(data);
    } catch (err) {
      console.error('Failed to fetch reports:', err);
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
      timeZone: 'Asia/Bangkok',
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  // Group by date for summary
  const groupedByDate = reports.data.reduce((acc, r) => {
    const date = r.summary_date;
    if (!acc[date]) {
      acc[date] = { purchased: 0, sold: 0, profit: 0, suppliers: [] };
    }
    acc[date].purchased += Number(r.purchased_thb);
    acc[date].sold += Number(r.sold_thb);
    acc[date].profit += Number(r.daily_profit_thb);
    acc[date].suppliers.push(r);
    return acc;
  }, {});

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6"><i className="fa-regular fa-square-plus"></i> Profit Reports</h1>

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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="stat-card bg-emerald-50">
          <div className="stat-label">Total Purchased</div>
          <div className="stat-value text-emerald-600">
            {formatNumber(reports.totals?.total_purchased_thb)} <span className="text-sm font-normal">THB</span>
          </div>
        </div>
        <div className="stat-card bg-blue-50">
          <div className="stat-label">Total Sold</div>
          <div className="stat-value text-blue-600">
            {formatNumber(reports.totals?.total_sold_thb)} <span className="text-sm font-normal">THB</span>
          </div>
        </div>
        <div className={`stat-card ${(reports.totals?.total_profit_thb || 0) >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
          <div className="stat-label">Total Profit</div>
          <div className={`stat-value ${(reports.totals?.total_profit_thb || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {(reports.totals?.total_profit_thb || 0) >= 0 ? '+' : ''}
            {formatNumber(reports.totals?.total_profit_thb)} <span className="text-sm font-normal">THB</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent mx-auto"></div>
        </div>
      ) : reports.data.length === 0 ? (
        <div className="card text-center py-16">
          <div className="text-6xl mb-4">📋</div>
          <h3 className="text-xl text-gray-600">No data found</h3>
          <p className="text-gray-500">Try adjusting your filters</p>
        </div>
      ) : (
        <>
          {/* Daily Summary Cards */}
          <div className="space-y-4">
            {Object.entries(groupedByDate).map(([date, data]) => (
              <div key={date} className="card">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">{formatDate(date)}</h3>
                  <div className="flex gap-4 text-sm">
                    <span className="text-emerald-600"><i className="fa-solid fa-circle-arrow-down mr-1"></i> +{formatNumber(data.purchased)}</span>
                    <span className="text-blue-600"><i className="fa-solid fa-circle-arrow-up mr-1"></i> -{formatNumber(data.sold)}</span>
                    <span className={data.profit >= 0 ? 'text-emerald-600 font-bold' : 'text-red-600 font-bold'}>
                      <i className="fa-regular fa-money-bill-1"></i> {data.profit >= 0 ? '+' : ''}{formatNumber(data.profit)} THB
                    </span>
                  </div>
                </div>
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Supplier</th>
                        <th>Opening</th>
                        <th>Purchased</th>
                        <th>Sold</th>
                        <th>Closing</th>
                        <th>Profit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.suppliers.map((s, idx) => (
                        <tr key={idx}>
                          <td className="font-medium">{s.supplier_name}</td>
                          <td>{formatNumber(s.opening_thb)}</td>
                          <td className="text-emerald-600">+{formatNumber(s.purchased_thb)}</td>
                          <td className="text-blue-600">-{formatNumber(s.sold_thb)}</td>
                          <td className="font-semibold">{formatNumber(s.closing_thb)}</td>
                          <td className={`font-semibold ${s.daily_profit_thb >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {s.daily_profit_thb >= 0 ? '+' : ''}{formatNumber(s.daily_profit_thb)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}