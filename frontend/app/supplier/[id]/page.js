'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function SupplierPage() {
  const params = useParams();
  const router = useRouter();
  const [supplier, setSupplier] = useState(null);
  const [allPurchases, setAllPurchases] = useState([]);
  const [allSales, setAllSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [viewMode, setViewMode] = useState('today'); // 'today' or 'all'
  const receiptRef = useRef(null);

  const [purchaseForm, setPurchaseForm] = useState({ mmk_amount: '', exchange_rate: '' });
  const [saleForm, setSaleForm] = useState({ customer_name: '', thb_amount: '', exchange_rate: '' });
  const [quickInput, setQuickInput] = useState('');

  useEffect(() => {
    fetchSupplier();
    fetchAllTransactions();
  }, [params.id]);

  const fetchSupplier = async () => {
    try {
      const res = await fetch(`${API_URL}/suppliers/${params.id}`);
      if (!res.ok) {
        router.push('/dashboard');
        return;
      }
      const data = await res.json();
      setSupplier(data);
    } catch (err) {
      console.error('Failed to fetch supplier:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllTransactions = async () => {
    try {
      const [purchasesRes, salesRes] = await Promise.all([
        fetch(`${API_URL}/purchases?supplier_id=${params.id}`),
        fetch(`${API_URL}/sales?supplier_id=${params.id}`)
      ]);
      
      const purchasesData = await purchasesRes.json();
      const salesData = await salesRes.json();
      
      setAllPurchases(purchasesData);
      setAllSales(salesData);
    } catch (err) {
      console.error('Failed to fetch all transactions:', err);
    }
  };

  const parseQuickSaleInput = (input) => {
    const cleanInput = input.replace(/,/g, '').trim();
    const matchDivision = cleanInput.match(/^([\d.]+)\/([\d.]+)=([\d.]+)\s+(.+)$/);
    if (matchDivision) {
      return {
        thb_amount: parseFloat(matchDivision[1]),
        exchange_rate: parseFloat(matchDivision[2]),
        customer_name: matchDivision[4].trim(),
      };
    }
    const matchMultiply = cleanInput.match(/^([\d.]+)\*([\d.]+)=([\d.]+)\s+(.+)$/);
    if (matchMultiply) {
      return {
        exchange_rate: parseFloat(matchMultiply[1]),
        thb_amount: parseFloat(matchMultiply[3]),
        customer_name: matchMultiply[4].trim(),
      };
    }
    return null;
  };

  const parseQuickPurchaseInput = (input) => {
    const cleanInput = input.replace(/,/g, '').replace(/\s/g, '').trim();
    const match = cleanInput.match(/^([\d.]+)\*([\d.]+)=([\d.]+)$/);
    if (match) {
      return {
        exchange_rate: parseFloat(match[1]),
        mmk_amount: parseFloat(match[2]),
      };
    }
    return null;
  };

  const applyQuickSale = () => {
    const parsed = parseQuickSaleInput(quickInput);
    if (parsed) {
      setSaleForm({
        customer_name: parsed.customer_name,
        thb_amount: parsed.thb_amount.toString(),
        exchange_rate: parsed.exchange_rate.toString(),
      });
      setQuickInput('');
    } else {
      alert('Invalid format!\n\nFormat 1: thb/rate=mmk Name\nExample: 5000/0.00791=632111 Tarrar\n\nFormat 2: rate*mmk=thb Name\nExample: 790*27=21330 Tarrar');
    }
  };

  const applyQuickPurchase = () => {
    const parsed = parseQuickPurchaseInput(quickInput);
    if (parsed) {
      setPurchaseForm({
        mmk_amount: parsed.mmk_amount.toString(),
        exchange_rate: parsed.exchange_rate.toString(),
      });
      setQuickInput('');
    } else {
      alert('Invalid format!\n\nFormat: rate*mmk=thb\nExample: 800*100=80000');
    }
  };

  const handleAddPurchase = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/purchases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_id: parseInt(params.id),
          mmk_amount: parseFloat(purchaseForm.mmk_amount),
          exchange_rate: parseFloat(purchaseForm.exchange_rate),
        }),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setShowPurchaseModal(false);
        setPurchaseForm({ mmk_amount: '', exchange_rate: '' });
        setQuickInput('');
        fetchSupplier();
        fetchAllTransactions();
      } else {
        alert('Error: ' + (data.error || 'Failed to add purchase'));
      }
    } catch (err) {
      console.error('Failed to add purchase:', err);
      alert('Failed to add purchase: ' + err.message);
    }
  };

  const handleAddSale = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/sales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_id: parseInt(params.id),
          customer_name: saleForm.customer_name,
          thb_amount: parseFloat(saleForm.thb_amount),
          exchange_rate: parseFloat(saleForm.exchange_rate),
        }),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setShowSaleModal(false);
        setSaleForm({ customer_name: '', thb_amount: '', exchange_rate: '' });
        setQuickInput('');
        fetchSupplier();
        fetchAllTransactions();
      } else {
        alert('Error: ' + (data.error || 'Failed to add sale'));
      }
    } catch (err) {
      console.error('Failed to add sale:', err);
      alert('Failed to add sale: ' + err.message);
    }
  };

  const showReceipt = async (saleId) => {
    try {
      const res = await fetch(`${API_URL}/receipt/${saleId}`);
      const data = await res.json();
      setSelectedReceipt(data);
      setShowReceiptModal(true);
    } catch (err) {
      console.error('Failed to fetch receipt:', err);
    }
  };

  const handlePrintReceipt = async () => {
    if (!receiptRef.current) return;
    
    try {
      const html2canvas = (await import('html2canvas')).default;
      
      // Capture at 2x for better text quality
      const canvas = await html2canvas(receiptRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
      });
      
      // Resize to exact dimensions
      const resizedCanvas = document.createElement('canvas');
      const ctx = resizedCanvas.getContext('2d');
      resizedCanvas.width = canvas.width / 2;
      resizedCanvas.height = canvas.height / 2;
      ctx.drawImage(canvas, 0, 0, resizedCanvas.width, resizedCanvas.height);
      
      const link = document.createElement('a');
      link.download = `receipt-${selectedReceipt.receipt_no}.png`;
      link.href = resizedCanvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Failed to generate receipt:', err);
      alert('Failed to generate receipt image');
    }
  };

  const handleDeletePurchase = async (id) => {
    if (!confirm('Delete this purchase?')) return;
    await fetch(`${API_URL}/purchases/${id}`, { method: 'DELETE' });
    fetchSupplier();
    fetchAllTransactions();
  };

  const handleDeleteSale = async (id) => {
    if (!confirm('Delete this sale?')) return;
    await fetch(`${API_URL}/sales/${id}`, { method: 'DELETE' });
    fetchSupplier();
    fetchAllTransactions();
  };

  const formatNumber = (num, decimals = 2) => {
    return Number(num || 0).toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  const formatDate = (date) => new Date(date).toLocaleString('en-GB', { timeZone: 'Asia/Bangkok' });
  const formatDateShort = (date) => new Date(date).toLocaleTimeString('en-GB', { 
    timeZone: 'Asia/Bangkok',
    hour: '2-digit', 
    minute: '2-digit' 
  });
  const formatDateFull = (date) => new Date(date).toLocaleDateString('en-GB', { 
    timeZone: 'Asia/Bangkok',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  // Get current display data based on view mode
  const displayPurchases = viewMode === 'today' ? (supplier?.purchases || []) : allPurchases;
  const displaySales = viewMode === 'today' ? (supplier?.sales || []) : allSales;

  // Calculate totals for all history
  const allPurchasesTotal = allPurchases.reduce((sum, p) => sum + Number(p.total_thb), 0);
  const allSalesTotal = allSales.reduce((sum, s) => sum + Number(s.thb_amount), 0);

  const calculatePurchaseTotal = () => {
    const mmk = parseFloat(purchaseForm.mmk_amount) || 0;
    const rate = parseFloat(purchaseForm.exchange_rate) || 0;
    return mmk * rate;
  };

  const calculateSaleTotal = () => {
    const thb = parseFloat(saleForm.thb_amount) || 0;
    const rate = parseFloat(saleForm.exchange_rate) || 0;
    return rate > 0 ? thb / rate : 0;
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent mx-auto"></div>
      </div>
    );
  }

  if (!supplier) return null;

  const summary = supplier.summary || {};

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Action Bar - Fixed at top */}
      <div className="bg-white border-b shadow-sm no-print">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="btn btn-ghost text-slate-600">
                ← Back
              </Link>
              <div>
                <h1 className="text-xl font-bold text-slate-800">{supplier.name}</h1>
                <p className="text-sm text-slate-500">Manage purchases and sales</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowPurchaseModal(true)} className="btn btn-success">
                <i className="fa-solid fa-circle-arrow-down mr-1"></i> Buy THB
              </button>
              <button onClick={() => setShowSaleModal(true)} className="btn btn-primary">
                <i className="fa-solid fa-circle-arrow-up mr-1"></i> Sell THB
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 no-print">
        {/* View Mode Toggle */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2 bg-white rounded-xl p-1 shadow-sm border">
            <button
              onClick={() => setViewMode('today')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                viewMode === 'today' 
                  ? 'bg-indigo-500 text-white shadow' 
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <i className="fa-regular fa-calendar mr-1"></i> Today
            </button>
            <button
              onClick={() => setViewMode('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                viewMode === 'all' 
                  ? 'bg-indigo-500 text-white shadow' 
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <i className="fa-regular fa-calendar-days mr-1"></i> All History
            </button>
          </div>
          {viewMode === 'all' && (
            <div className="text-sm text-slate-500">
              Total: <span className="text-emerald-600 font-semibold">+{formatNumber(allPurchasesTotal)}</span> purchased, 
              <span className="text-blue-600 font-semibold ml-1">-{formatNumber(allSalesTotal)}</span> sold
            </div>
          )}
        </div>

        {/* Daily Summary - Only show for today view */}
        {viewMode === 'today' && (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
            <div className="stat-card">
              <div className="stat-label">Opening</div>
              <div className="stat-value text-gray-600">{formatNumber(summary.opening_thb)}</div>
            </div>
            <div className="stat-card bg-emerald-50">
              <div className="stat-label">Purchased</div>
              <div className="stat-value text-emerald-600">+{formatNumber(summary.purchased_thb)}</div>
            </div>
            <div className="stat-card bg-blue-50">
              <div className="stat-label">Sold</div>
              <div className="stat-value text-blue-600">-{formatNumber(summary.sold_thb)}</div>
            </div>
            <div className="stat-card bg-amber-50">
              <div className="stat-label">Balance</div>
              <div className="stat-value text-amber-600">{formatNumber(summary.closing_thb)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Avg Rate</div>
              <div className="stat-value text-gray-600">{formatNumber(summary.closing_avg_rate, 4)}</div>
            </div>
            <div className={`stat-card ${summary.daily_profit_thb >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
              <div className="stat-label">Profit</div>
              <div className={`stat-value ${summary.daily_profit_thb >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {summary.daily_profit_thb >= 0 ? '+' : ''}{formatNumber(summary.daily_profit_thb)}
              </div>
            </div>
          </div>
        )}

        {/* Purchases */}
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">
              <i className="fa-solid fa-circle-arrow-down mr-1"></i> {viewMode === 'today' ? "Today's" : "All"} Purchases (Buy THB)
            </h2>
            <span className="badge badge-success">{displayPurchases.length} transactions</span>
          </div>
          {displayPurchases.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No purchases {viewMode === 'today' ? 'today' : 'yet'}</p>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    {viewMode === 'all' && <th>Date</th>}
                    <th>Time</th>
                    <th>MMK</th>
                    <th>Rate</th>
                    <th>THB</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {displayPurchases.map((p) => (
                    <tr key={p.id}>
                      {viewMode === 'all' && <td>{formatDateFull(p.created_at)}</td>}
                      <td>{formatDateShort(p.created_at)}</td>
                      <td>{formatNumber(p.mmk_amount, 5)}</td>
                      <td>{formatNumber(p.exchange_rate, 4)}</td>
                      <td className="font-semibold text-emerald-600">{formatNumber(p.total_thb)}</td>
                      <td>
                        <button onClick={() => handleDeletePurchase(p.id)} className="btn btn-danger text-xs py-1 px-2">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Sales */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">
              <i className="fa-solid fa-circle-arrow-up mr-1"></i> {viewMode === 'today' ? "Today's" : "All"} Sales (Sell THB)
            </h2>
            <span className="badge badge-info">{displaySales.length} transactions</span>
          </div>
          {displaySales.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No sales {viewMode === 'today' ? 'today' : 'yet'}</p>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    {viewMode === 'all' && <th>Date</th>}
                    <th>Time</th>
                    <th>Receipt</th>
                    <th>Customer</th>
                    <th>THB</th>
                    <th>Rate</th>
                    <th>MMK</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {displaySales.map((s) => (
                    <tr key={s.id}>
                      {viewMode === 'all' && <td>{formatDateFull(s.created_at)}</td>}
                      <td>{formatDateShort(s.created_at)}</td>
                      <td><span className="badge badge-info">{s.receipt_no}</span></td>
                      <td>{s.customer_name}</td>
                      <td>{formatNumber(s.thb_amount)}</td>
                      <td>{formatNumber(s.exchange_rate, 4)}</td>
                      <td className="font-semibold text-blue-600">{formatNumber(s.total_mmk, 5)}</td>
                      <td className="flex gap-1">
                        <button onClick={() => showReceipt(s.id)} className="btn btn-warning text-xs py-1 px-2"><i className="fa-regular fa-receipt"></i></button>
                        <button onClick={() => handleDeleteSale(s.id)} className="btn btn-danger text-xs py-1 px-2">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Purchase Modal */}
      {showPurchaseModal && (
        <div className="modal-overlay" onClick={() => setShowPurchaseModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-semibold mb-6"><i className="fa-solid fa-circle-arrow-down mr-1"></i> Buy THB (Give MMK, Get THB)</h2>
            <div className="quick-input-box bg-emerald-50 border-emerald-200 mb-6">
              <label className="label text-emerald-700">⚡ Quick Input</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="input flex-1"
                  placeholder="800*100=80000"
                  value={quickInput}
                  onChange={(e) => setQuickInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && applyQuickPurchase()}
                  autoFocus
                />
                <button onClick={applyQuickPurchase} className="btn btn-success">Apply</button>
              </div>
              <p className="text-xs text-emerald-600 mt-2">Format: rate*mmk=thb</p>
            </div>
            <div className="divider"><div className="divider-line"></div><div className="divider-text"><span>or fill manually</span></div></div>
            <form onSubmit={handleAddPurchase}>
              <div className="mb-4">
                <label className="label">MMK Amount</label>
                <input type="number" step="0.00001" className="input" value={purchaseForm.mmk_amount} onChange={(e) => setPurchaseForm({ ...purchaseForm, mmk_amount: e.target.value })} required />
              </div>
              <div className="mb-4">
                <label className="label">Exchange Rate (THB per MMK)</label>
                <input type="number" step="0.0001" className="input" value={purchaseForm.exchange_rate} onChange={(e) => setPurchaseForm({ ...purchaseForm, exchange_rate: e.target.value })} required />
              </div>
              <div className="p-4 bg-gray-50 rounded-lg text-center mb-6">
                <div className="text-sm text-gray-500">Total THB</div>
                <div className="text-3xl font-bold text-emerald-600">{formatNumber(calculatePurchaseTotal())}</div>
              </div>
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setShowPurchaseModal(false)} className="btn btn-ghost">Cancel</button>
                <button type="submit" className="btn btn-success">Add Purchase</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sale Modal */}
      {showSaleModal && (
        <div className="modal-overlay" onClick={() => setShowSaleModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-semibold mb-6"><i className="fa-solid fa-circle-arrow-up mr-1"></i> Sell THB (Give THB, Get MMK)</h2>
            <div className="quick-input-box bg-blue-50 border-blue-200 mb-6">
              <label className="label text-blue-700">⚡ Quick Input (Single Line)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="input flex-1"
                  placeholder="5000/0.00791=632111 Tarrar"
                  value={quickInput}
                  onChange={(e) => setQuickInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && applyQuickSale()}
                  autoFocus
                />
                <button onClick={applyQuickSale} className="btn btn-primary">Apply</button>
              </div>
              <p className="text-xs text-blue-600 mt-2">
                Format 1: thb/rate=mmk Name (5000/0.00791=632111 Tarrar)<br/>
                Format 2: rate*mmk=thb Name (790*27=21330 Tarrar)
              </p>
            </div>
            <div className="divider"><div className="divider-line"></div><div className="divider-text"><span>or fill manually</span></div></div>
            <form onSubmit={handleAddSale}>
              <div className="mb-4">
                <label className="label">Customer Name</label>
                <input type="text" className="input" value={saleForm.customer_name} onChange={(e) => setSaleForm({ ...saleForm, customer_name: e.target.value })} required />
              </div>
              <div className="mb-4">
                <label className="label">THB Amount</label>
                <input type="number" step="0.01" className="input" value={saleForm.thb_amount} onChange={(e) => setSaleForm({ ...saleForm, thb_amount: e.target.value })} required />
              </div>
              <div className="mb-4">
                <label className="label">Exchange Rate</label>
                <input type="number" step="0.00001" className="input" value={saleForm.exchange_rate} onChange={(e) => setSaleForm({ ...saleForm, exchange_rate: e.target.value })} required />
              </div>
              <div className="p-4 bg-gray-50 rounded-lg text-center mb-6">
                <div className="text-sm text-gray-500">Total MMK</div>
                <div className="text-3xl font-bold text-blue-600">{formatNumber(calculateSaleTotal(), 5)}</div>
              </div>
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setShowSaleModal(false)} className="btn btn-ghost">Cancel</button>
                <button type="submit" className="btn btn-primary">Add Sale</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {showReceiptModal && selectedReceipt && (
        <div className="modal-overlay" onClick={() => setShowReceiptModal(false)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4 no-print">
              <h2 className="text-xl font-semibold"><i className="fa-regular fa-receipt"></i>Receipt</h2>
              <div className="flex gap-2">
                <button onClick={handlePrintReceipt} className="btn btn-primary"><i className="fa-regular fa-print mr-1"></i> Print</button>
                <button onClick={() => setShowReceiptModal(false)} className="btn btn-ghost">Close</button>
              </div>
            </div>
            <div className="print-area">
              <div className="receipt border-2 border-gray-300" ref={receiptRef}>
                <div className="receipt border-2 border-gray-300">
                  <div className="receipt-header">
                    <h3 className="text-xl font-bold">{selectedReceipt.business_name}</h3>
                    <p className="text-gray-500">Currency Exchange</p>
                  </div>
                  <div className="receipt-row">
                    <span>Receipt No:</span>
                    <span className="font-bold">{selectedReceipt.receipt_no}</span>
                  </div>
                  <div className="receipt-row">
                    <span>Date:</span>
                    <span>{formatDate(selectedReceipt.created_at)}</span>
                  </div>
                  <div className="receipt-row">
                    <span>Customer:</span>
                    <span>{selectedReceipt.customer_name}</span>
                  </div>
                  <div className="border-t border-dashed border-gray-300 my-4"></div>
                  <div className="receipt-row">
                    <span>THB Amount:</span>
                    <span>{formatNumber(selectedReceipt.thb_amount)} THB</span>
                  </div>
                  <div className="receipt-row">
                    <span>Exchange Rate:</span>
                    <span>{formatNumber(selectedReceipt.exchange_rate, 5)}</span>
                  </div>
                  <div className="receipt-total">
                    <div className="receipt-row">
                      <span>Total MMK:</span>
                      <span>{formatNumber(selectedReceipt.total_mmk, 2)} MMK</span>
                    </div>
                  </div>
                  <div className="text-center mt-6 text-gray-500 text-xs">
                    <p>Thank you for your business!</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}