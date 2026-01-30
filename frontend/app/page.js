'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [apiUrl, setApiUrl] = useState('');
  const [form, setForm] = useState({ username: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ username: '', email: '', password: '', registrationKey: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showRegister, setShowRegister] = useState(false);

  useEffect(() => {
    // Get API URL from environment or use default
    const url = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    setApiUrl(url);
    console.log('API URL:', url);

    const user = localStorage.getItem('user');
    if (user) {
      router.push('/dashboard');
    }
  }, [router]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!apiUrl) {
      setError('API URL not configured. Set NEXT_PUBLIC_API_URL in environment.');
      setLoading(false);
      return;
    }

    try {
      console.log('Logging in to:', apiUrl + '/auth/login');
      const res = await fetch(apiUrl + '/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      console.log('Login response:', data);

      if (!res.ok) {
        setError(data.error || 'Login failed');
        setLoading(false);
        return;
      }

      localStorage.setItem('user', JSON.stringify(data));
      router.push('/dashboard');
    } catch (err) {
      console.error('Login error:', err);
      setError('Cannot connect to API: ' + apiUrl + ' - Error: ' + err.message);
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!apiUrl) {
      setError('API URL not configured. Set NEXT_PUBLIC_API_URL in environment.');
      setLoading(false);
      return;
    }

    try {
      console.log('Registering to:', apiUrl + '/auth/register');
      const res = await fetch(apiUrl + '/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registerForm),
      });

      const data = await res.json();
      console.log('Register response:', data);

      if (!res.ok) {
        setError(data.error || 'Registration failed');
        setLoading(false);
        return;
      }

      alert('Registration successful! Please login.');
      setShowRegister(false);
      setForm({ username: registerForm.username, password: registerForm.password });
      setLoading(false);
    } catch (err) {
      console.error('Register error:', err);
      setError('Cannot connect to API: ' + apiUrl + ' - Error: ' + err.message);
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(to bottom right, #2563eb, #7c3aed)', padding: '20px' }}>
      <div className="card" style={{ width: '100%', maxWidth: '400px' }}>
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold"><i className="fa-solid fa-money-bill-transfer mr-2"></i>Mai Soong</h1>
          <p className="text-gray text-sm mt-4">Exchange Rate Tracker</p>
        </div>

        {error && <div className="error"><i className="fa-solid fa-triangle-exclamation mr-1"></i> {error}</div>}

        {!apiUrl && (
          <div className="error">
            <i className="fa-solid fa-triangle-exclamation mr-1"></i> NEXT_PUBLIC_API_URL is not set! Add it in Dokploy environment variables.
          </div>
        )}

        {!showRegister ? (
          <form onSubmit={handleLogin}>
            <div className="mb-4">
              <label className="text-sm font-bold" style={{ display: 'block', marginBottom: '8px' }}>Username</label>
              <input
                type="text"
                className="input"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                required
              />
            </div>

            <div className="mb-6">
              <label className="text-sm font-bold" style={{ display: 'block', marginBottom: '8px' }}>Password</label>
              <input
                type="password"
                className="input"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary w-full" disabled={loading || !apiUrl}>
              {loading ? 'Logging in...' : 'Login'}
            </button>

            <p className="text-center mt-4 text-sm">
              No account?{' '}
              <button type="button" onClick={() => setShowRegister(true)} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer' }}>
                Register
              </button>
            </p>
          </form>
        ) : (
          <form onSubmit={handleRegister}>
            <div className="mb-4">
              <label className="text-sm font-bold" style={{ display: 'block', marginBottom: '8px' }}>Username</label>
              <input
                type="text"
                className="input"
                value={registerForm.username}
                onChange={(e) => setRegisterForm({ ...registerForm, username: e.target.value })}
                required
              />
            </div>

            <div className="mb-4">
              <label className="text-sm font-bold" style={{ display: 'block', marginBottom: '8px' }}>Email</label>
              <input
                type="email"
                className="input"
                value={registerForm.email}
                onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
              />
            </div>

            <div className="mb-4">
              <label className="text-sm font-bold" style={{ display: 'block', marginBottom: '8px' }}>Password</label>
              <input
                type="password"
                className="input"
                value={registerForm.password}
                onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                required
              />
            </div>

            <div className="mb-6">
              <label className="text-sm font-bold" style={{ display: 'block', marginBottom: '8px' }}>Registration Key</label>
              <input
                type="text"
                className="input"
                value={registerForm.registrationKey}
                onChange={(e) => setRegisterForm({ ...registerForm, registrationKey: e.target.value })}
                placeholder="MAISOONG2025KEY"
                required
              />
            </div>

            <button type="submit" className="btn btn-primary w-full" disabled={loading || !apiUrl}>
              {loading ? 'Registering...' : 'Register'}
            </button>

            <p className="text-center mt-4 text-sm">
              Have account?{' '}
              <button type="button" onClick={() => setShowRegister(false)} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer' }}>
                Login
              </button>
            </p>
          </form>
        )}

        <div style={{ marginTop: '20px', padding: '10px', background: '#f3f4f6', borderRadius: '8px', fontSize: '12px' }}>
          <p><strong>API URL:</strong> {apiUrl || 'NOT SET'}</p>
        </div>
      </div>
    </div>
  );
}