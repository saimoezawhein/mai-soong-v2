'use client';

import { useEffect, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function RateHistoryPage() {
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [days, setDays] = useState('7');

  useEffect(() => {
    fetchSuppliers();
  }, []);

  useEffect(() => {
    fetchData();
  }, [selectedSupplier, selectedType, days]);

  const fetchSuppliers = async () => {
    try {
      const res = await fetch(`${API_URL}/suppliers`);
      const data = await res.json();
      setSuppliers(data);
    } catch (err) {
      console.error('Failed to fetch suppliers:', err);
    }
  };

  const fetchData = async () => {
    try {
      let historyUrl = `${API_URL}/rate-history?limit=100`;
      if (selectedSupplier) historyUrl += `&supplier_id=${selectedSupplier}`;
      if (selectedType) historyUrl += `&rate_type=${selectedType}`;

      let statsUrl = `${API_URL}/rate-history/stats?days=${days}`;
      if (selectedSupplier) statsUrl += `&supplier_id=${selectedSupplier}`;

      const [historyRes, statsRes] = await Promise.all([
        fetch(historyUrl),
        fetch(statsUrl),
      ]);

      const historyData = await historyRes.json();
      const statsData = await statsRes.json();

      setHistory(historyData);
      setStats(statsData);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num, decimals = 4) => {
    return Number(num || 0).toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-GB', {
      timeZone: 'Asia/Bangkok',
      day: '2-digit',
      month: '2-digit',
    });
  };

  const formatDateTime = (date) => {
    return new Date(date).toLocaleString('en-GB', { timeZone: 'Asia/Bangkok' });
  };

  // Group stats by date
  const groupedStats = stats.reduce((acc, s) => {
    if (!acc[s.date]) {
      acc[s.date] = { buy: null, sell: null };
    }
    acc[s.date][s.rate_type] = s;
    return acc;
  }, {});

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6"><i className="fa-regular fa-chart-bar"></i> Rate History</h1>

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
            <label className="label">Type</label>
            <select
              className="input"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
            >
              <option value="">All Types</option>
              <option value="buy">Buy Only</option>
              <option value="sell">Sell Only</option>
            </select>
          </div>
          <div>
            <label className="label">Period</label>
            <select
              className="input"
              value={days}
              onChange={(e) => setDays(e.target.value)}
            >
              <option value="7">Last 7 days</option>
              <option value="14">Last 14 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                setSelectedSupplier('');
                setSelectedType('');
                setDays('7');
              }}
              className="btn btn-ghost w-full"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent mx-auto"></div>
        </div>
      ) : (
        <>
          {/* Stats Summary */}
          <div className="card mb-6">
            <h2 className="text-lg font-semibold mb-4"><i className="fa-regular fa-chart-bar"></i> Rate Summary (Last {days} days)</h2>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Buy Avg</th>
                    <th>Buy Min</th>
                    <th>Buy Max</th>
                    <th>Buy Count</th>
                    <th>Sell Avg</th>
                    <th>Sell Min</th>
                    <th>Sell Max</th>
                    <th>Sell Count</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(groupedStats).map(([date, data]) => (
                    <tr key={date}>
                      <td className="font-medium">{formatDate(date)}</td>
                      <td className="text-emerald-600">{data.buy ? formatNumber(data.buy.avg_rate) : '-'}</td>
                      <td>{data.buy ? formatNumber(data.buy.min_rate) : '-'}</td>
                      <td>{data.buy ? formatNumber(data.buy.max_rate) : '-'}</td>
                      <td>{data.buy?.transaction_count || 0}</td>
                      <td className="text-blue-600">{data.sell ? formatNumber(data.sell.avg_rate) : '-'}</td>
                      <td>{data.sell ? formatNumber(data.sell.min_rate) : '-'}</td>
                      <td>{data.sell ? formatNumber(data.sell.max_rate) : '-'}</td>
                      <td>{data.sell?.transaction_count || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Transaction History */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4"><i className="fa-regular fa-file-lines"></i> Transaction History</h2>
            {history.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No rate history found</p>
            ) : (
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date/Time</th>
                      <th>Supplier</th>
                      <th>Type</th>
                      <th>Rate</th>
                      <th>MMK</th>
                      <th>THB</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h) => (
                      <tr key={h.id}>
                        <td>{formatDateTime(h.recorded_at)}</td>
                        <td>{h.supplier_name}</td>
                        <td>
                          <span className={`badge ${h.rate_type === 'buy' ? 'badge-success' : 'badge-info'}`}>
                            {h.rate_type === 'buy' ? (
                              <><i className="fa-solid fa-circle-arrow-down mr-1"></i> Buy</>
                            ) : (
                              <><i className="fa-solid fa-circle-arrow-up mr-1"></i> Sell</>
                            )}
                          </span>
                        </td>
                        <td className="font-semibold">{formatNumber(h.exchange_rate)}</td>
                        <td>{h.mmk_amount ? formatNumber(h.mmk_amount, 5) : '-'}</td>
                        <td>{h.thb_amount ? formatNumber(h.thb_amount, 2) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}