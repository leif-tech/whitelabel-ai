import { useState } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';

export default function Home() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ email: '', password: '', agency_name: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const payload = isLogin ? { email: form.email, password: form.password } : form;
      const { data } = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}${endpoint}`, payload);
      localStorage.setItem('token', data.token);
      localStorage.setItem('agency', JSON.stringify(data.agency));
      router.push('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">WhiteLabelAI</h1>
          <p className="text-gray-400">AI chatbots for your clients, branded as yours</p>
        </div>
        <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800">
          <div className="flex mb-6 bg-gray-800 rounded-lg p-1">
            <button onClick={() => setIsLogin(true)} className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${isLogin ? 'bg-white text-gray-900' : 'text-gray-400'}`}>Login</button>
            <button onClick={() => setIsLogin(false)} className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${!isLogin ? 'bg-white text-gray-900' : 'text-gray-400'}`}>Register</button>
          </div>
          {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg p-3 mb-4 text-sm">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="text-gray-400 text-sm mb-1 block">Agency Name</label>
                <input type="text" placeholder="WebForge" value={form.agency_name} onChange={e => setForm({...form, agency_name: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" required />
              </div>
            )}
            <div>
              <label className="text-gray-400 text-sm mb-1 block">Email</label>
              <input type="email" placeholder="you@agency.com" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" required />
            </div>
            <div>
              <label className="text-gray-400 text-sm mb-1 block">Password</label>
              <input type="password" placeholder="••••••••" value={form.password} onChange={e => setForm({...form, password: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" required />
            </div>
            <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition-all disabled:opacity-50">
              {loading ? 'Please wait...' : isLogin ? 'Login' : 'Create Account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}