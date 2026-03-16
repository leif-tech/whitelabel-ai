import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';

export default function Dashboard() {
  const router = useRouter();
  const [agency, setAgency] = useState(null);
  const [bots, setBots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ bot_name: '', client_name: '', greeting_message: '', primary_color: '#0066cc' });

  useEffect(() => {
    const token = localStorage.getItem('token');
    const agencyData = localStorage.getItem('agency');
    if (!token) { router.push('/'); return; }
    setAgency(JSON.parse(agencyData));
    fetchBots(token);
  }, []);

  const fetchBots = async (token) => {
    try {
      const { data } = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/bots`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBots(data.bots);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const createBot = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    try {
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/bots`, form, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShowCreate(false);
      setForm({ bot_name: '', client_name: '', greeting_message: '', primary_color: '#0066cc' });
      fetchBots(token);
    } catch (err) {
      console.error(err);
    }
  };

  const logout = () => {
    localStorage.clear();
    router.push('/');
  };

  if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center"><div className="text-white">Loading...</div></div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="border-b border-gray-800 px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold">WhiteLabelAI</h1>
          <p className="text-gray-400 text-sm">{agency?.agency_name}</p>
        </div>
        <button onClick={logout} className="text-gray-400 hover:text-white text-sm">Logout</button>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
            <div className="text-3xl font-bold">{bots.length}</div>
            <div className="text-gray-400 text-sm mt-1">Total Bots</div>
          </div>
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
            <div className="text-3xl font-bold">{bots.filter(b => b.is_active).length}</div>
            <div className="text-gray-400 text-sm mt-1">Active Bots</div>
          </div>
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
            <div className="text-3xl font-bold capitalize">{agency?.plan}</div>
            <div className="text-gray-400 text-sm mt-1">Current Plan</div>
          </div>
        </div>

        {/* Bots Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Your Bots</h2>
          <button onClick={() => setShowCreate(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">+ New Bot</button>
        </div>

        {/* Create Bot Modal */}
        {showCreate && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-md border border-gray-800">
              <h3 className="text-lg font-semibold mb-4">Create New Bot</h3>
              <form onSubmit={createBot} className="space-y-4">
                <div>
                  <label className="text-gray-400 text-sm mb-1 block">Bot Name</label>
                  <input type="text" placeholder="SmileBot" value={form.bot_name} onChange={e => setForm({...form, bot_name: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" required />
                </div>
                <div>
                  <label className="text-gray-400 text-sm mb-1 block">Client Name</label>
                  <input type="text" placeholder="Smile Dental Clinic" value={form.client_name} onChange={e => setForm({...form, client_name: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" required />
                </div>
                <div>
                  <label className="text-gray-400 text-sm mb-1 block">Greeting Message</label>
                  <input type="text" placeholder="Hi! How can I help you today?" value={form.greeting_message} onChange={e => setForm({...form, greeting_message: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-gray-400 text-sm mb-1 block">Brand Color</label>
                  <input type="color" value={form.primary_color} onChange={e => setForm({...form, primary_color: e.target.value})} className="w-full h-12 bg-gray-800 border border-gray-700 rounded-lg cursor-pointer" />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowCreate(false)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-lg">Cancel</button>
                  <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium">Create Bot</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Bots List */}
        {bots.length === 0 ? (
          <div className="bg-gray-900 rounded-xl p-12 border border-gray-800 text-center">
            <div className="text-4xl mb-3">🤖</div>
            <div className="text-gray-400">No bots yet. Create your first bot!</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {bots.map(bot => (
              <div key={bot.id} onClick={() => router.push(`/bot/${bot.id}`)} className="bg-gray-900 rounded-xl p-5 border border-gray-800 cursor-pointer hover:border-gray-600 transition-all">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold" style={{background: bot.primary_color}}>{bot.bot_name[0]}</div>
                  <div>
                    <div className="font-semibold">{bot.bot_name}</div>
                    <div className="text-gray-400 text-sm">{bot.client_name}</div>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className={`text-xs px-2 py-1 rounded-full ${bot.is_active ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-400'}`}>{bot.is_active ? 'Active' : 'Inactive'}</span>
                  <span className="text-gray-500 text-xs">→ Manage</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}