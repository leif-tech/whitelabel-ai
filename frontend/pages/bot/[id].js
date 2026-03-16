import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';

export default function BotPage() {
  const router = useRouter();
  const { id } = router.query;
  const [bot, setBot] = useState(null);
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [testMsg, setTestMsg] = useState('');
  const [testReply, setTestReply] = useState('');
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (!id) return;
    const token = localStorage.getItem('token');
    if (!token) { router.push('/'); return; }
    fetchBot(token);
    fetchDocs(token);
  }, [id]);

  const fetchBot = async (token) => {
    try {
      const { data } = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/bots/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBot(data.bot);
    } catch (err) {
      console.error('fetchBot error:', err.response?.data || err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchDocs = async (token) => {
    try {
      const { data } = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/documents/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDocs(data.documents);
    } catch (err) {
      console.error(err);
    }
  };

  const addText = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setUploading(true);
    const token = localStorage.getItem('token');
    try {
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/documents/${id}/text`, { content: text }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setText('');
      setMessage('Text learned successfully!');
      fetchDocs(token);
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Error adding text');
    } finally {
      setUploading(false);
    }
  };

  const addUrl = async (e) => {
    e.preventDefault();
    if (!url.trim()) return;
    setUploading(true);
    const token = localStorage.getItem('token');
    try {
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/documents/${id}/url`, { url }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUrl('');
      setMessage('URL scraped and learned!');
      fetchDocs(token);
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Error scraping URL');
    } finally {
      setUploading(false);
    }
  };

  const deleteDoc = async (docId) => {
    const token = localStorage.getItem('token');
    try {
      await axios.delete(`${process.env.NEXT_PUBLIC_API_URL}/api/documents/${id}/${docId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchDocs(token);
    } catch (err) {
      console.error(err);
    }
  };

  const testChat = async (e) => {
    e.preventDefault();
    if (!testMsg.trim()) return;
    setTesting(true);
    try {
      const { data } = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/chat/${id}`, {
        message: testMsg,
        session_id: 'dashboard-test'
      });
      setTestReply(data.reply);
    } catch (err) {
      setTestReply('Error testing bot');
    } finally {
      setTesting(false);
    }
  };

  const embedCode = `<script src="https://whitelabelai.com/widget.js" data-bot-id="${id}"></script>`;

  if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center"><div className="text-white">Loading...</div></div>;

  if (!bot) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center">
        <div className="text-white text-xl mb-4">Bot not found</div>
        <button onClick={() => router.push('/dashboard')} className="text-blue-400 hover:text-blue-300">Back to Dashboard</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="border-b border-gray-800 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/dashboard')} className="text-gray-400 hover:text-white">← Back</button>
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{background: bot.primary_color}}>{bot.bot_name[0]}</div>
          <div>
            <div className="font-semibold">{bot.bot_name}</div>
            <div className="text-gray-400 text-xs">{bot.client_name}</div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
            <h2 className="font-semibold mb-4">📚 Knowledge Base</h2>
            {message && <div className="bg-green-500/10 border border-green-500/20 text-green-400 rounded-lg p-3 mb-4 text-sm">{message}</div>}
            <form onSubmit={addText} className="mb-4">
              <label className="text-gray-400 text-sm mb-2 block">Add Text</label>
              <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Paste your FAQ, services, pricing, hours..." className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 h-28 resize-none" />
              <button type="submit" disabled={uploading} className="mt-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50">
                {uploading ? 'Learning...' : 'Add Text'}
              </button>
            </form>
            <form onSubmit={addUrl}>
              <label className="text-gray-400 text-sm mb-2 block">Scrape Website URL</label>
              <div className="flex gap-2">
                <input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://clientwebsite.com" className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm" />
                <button type="submit" disabled={uploading} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50">
                  {uploading ? '...' : 'Scrape'}
                </button>
              </div>
            </form>
            {docs.length > 0 && (
              <div className="mt-4">
                <div className="text-gray-400 text-xs mb-2">Learned Documents ({docs.length})</div>
                <div className="space-y-2">
                  {docs.map(doc => (
                    <div key={doc.id} className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2">
                      <span className="text-sm text-gray-300 truncate">{doc.file_name}</span>
                      <button onClick={() => deleteDoc(doc.id)} className="text-red-400 hover:text-red-300 text-xs ml-2">Delete</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
            <h2 className="font-semibold mb-3">🔗 Embed Code</h2>
            <p className="text-gray-400 text-sm mb-3">Paste this before the closing body tag on your client's website.</p>
            <div className="bg-gray-800 rounded-lg p-3 font-mono text-xs text-green-400 break-all">{embedCode}</div>
            <button onClick={() => navigator.clipboard.writeText(embedCode)} className="mt-3 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm">Copy Code</button>
          </div>
        </div>

        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 flex flex-col">
          <h2 className="font-semibold mb-4">💬 Test Your Bot</h2>
          <div className="flex-1 bg-gray-800 rounded-lg p-4 mb-4 min-h-48">
            {!testReply && <div className="text-gray-500 text-sm">Ask your bot something to test it...</div>}
            {testReply && (
              <div className="space-y-3">
                <div className="flex justify-end">
                  <div className="bg-blue-600 rounded-lg px-3 py-2 text-sm max-w-xs">{testMsg}</div>
                </div>
                <div className="flex justify-start">
                  <div className="bg-gray-700 rounded-lg px-3 py-2 text-sm max-w-xs">{testReply}</div>
                </div>
              </div>
            )}
          </div>
          <form onSubmit={testChat} className="flex gap-2">
            <input type="text" value={testMsg} onChange={e => setTestMsg(e.target.value)} placeholder="Ask your bot something..." className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm" />
            <button type="submit" disabled={testing} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50">
              {testing ? '...' : 'Send'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}