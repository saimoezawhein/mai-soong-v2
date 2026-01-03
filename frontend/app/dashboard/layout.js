'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';

const API_URL = process.env.API_URL || 'http://localhost:3001';

export default function DashboardLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [showAlerts, setShowAlerts] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
      router.push('/login');
      return;
    }
    setUser(JSON.parse(storedUser));
    fetchAlerts();
  }, [router]);

  const fetchAlerts = async () => {
    try {
      const res = await fetch(`${API_URL}/alerts/low-balance`);
      const data = await res.json();
      setAlerts(data);
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    router.push('/login');
  };

  const navLinks = [
    { href: '/dashboard', label: '📊 Dashboard', icon: '📊' },
    { href: '/daily-summary', label: '📅 Daily Summary', icon: '📅' },
    { href: '/rate-history', label: '📈 Rate History', icon: '📈' },
    { href: '/reports', label: '📋 Reports', icon: '📋' },
  ];

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="header-gradient text-white shadow-lg sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/dashboard" className="text-xl font-bold flex items-center gap-2">
              💱 Mai Soong
            </Link>

            {/* Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    pathname === link.href
                      ? 'bg-white/20 font-medium'
                      : 'hover:bg-white/10'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Right side */}
            <div className="flex items-center gap-4">
              {/* Alerts */}
              <div className="relative">
                <button
                  onClick={() => setShowAlerts(!showAlerts)}
                  className={`p-2 rounded-lg hover:bg-white/10 relative ${
                    alerts.length > 0 ? 'animate-pulse-slow' : ''
                  }`}
                >
                  🔔
                  {alerts.length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                      {alerts.length}
                    </span>
                  )}
                </button>

                {showAlerts && (
                  <div className="absolute right-0 top-12 w-80 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden">
                    <div className="p-3 bg-gray-50 border-b font-medium text-gray-800">
                      ⚠️ Low Balance Alerts
                    </div>
                    {alerts.length === 0 ? (
                      <div className="p-4 text-gray-500 text-center">
                        No alerts
                      </div>
                    ) : (
                      <div className="max-h-64 overflow-y-auto">
                        {alerts.map((alert, idx) => (
                          <div key={idx} className="p-3 border-b last:border-0 hover:bg-gray-50">
                            <div className="font-medium text-gray-800">{alert.name}</div>
                            <div className="text-sm text-red-600">
                              Balance: {Number(alert.current_balance || 0).toLocaleString()} THB
                            </div>
                            <div className="text-xs text-gray-500">
                              Threshold: {Number(alert.threshold).toLocaleString()} THB
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* User */}
              <div className="flex items-center gap-3">
                <span className="hidden sm:block text-sm opacity-90">
                  {user.username}
                </span>
                <button
                  onClick={handleLogout}
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-sm"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden border-t border-white/10 overflow-x-auto">
          <div className="flex px-4 py-2 gap-2">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap text-sm ${
                  pathname === link.href
                    ? 'bg-white/20 font-medium'
                    : 'hover:bg-white/10'
                }`}
              >
                {link.icon}
              </Link>
            ))}
          </div>
        </div>
      </header>

      {/* Low Balance Alert Banner */}
      {alerts.length > 0 && (
        <div className="bg-red-500 text-white px-4 py-2 text-center text-sm">
          ⚠️ {alerts.length} supplier(s) have low balance!
        </div>
      )}

      {/* Main Content */}
      <main>{children}</main>
    </div>
  );
}
