import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';

const API = process.env.NEXT_PUBLIC_API_URL;

// Redirect to login on expired/invalid token
axios.interceptors.response.use(res => res, err => {
  if (err.response?.status === 401 && typeof window !== 'undefined') {
    localStorage.removeItem('token');
    localStorage.removeItem('agency');
    window.location.href = '/';
  }
  return Promise.reject(err);
});

export default function BotPage() {
  const router = useRouter();
  const { id } = router.query;
  const fileInputRef = useRef(null);

  const [bot, setBot] = useState(null);
  const [docs, setDocs] = useState([]);
  const [stats, setStats] = useState({ total_messages: 0, total_conversations: 0, total_documents: 0 });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState('settings');

  // Knowledge base
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [uploading, setUploading] = useState(false);

  // Bot settings form
  const [settings, setSettings] = useState({});
  const [saving, setSaving] = useState(false);

  // Test chat
  const [chatMessages, setChatMessages] = useState([]);
  const [testMsg, setTestMsg] = useState('');
  const [testing, setTesting] = useState(false);
  const chatEndRef = useRef(null);

  // Conversations inbox
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [threadMessages, setThreadMessages] = useState([]);
  const [loadingThread, setLoadingThread] = useState(false);

  // Leads
  const [leads, setLeads] = useState([]);

  const getToken = () => localStorage.getItem('token');
  const headers = () => ({ Authorization: `Bearer ${getToken()}` });

  useEffect(() => {
    if (!id) return;
    if (!getToken()) { router.push('/'); return; }
    fetchAll();
  }, [id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const fetchAll = async () => {
    await Promise.all([fetchBot(), fetchDocs(), fetchStats(), fetchSessions(), fetchLeads()]);
    setLoading(false);
  };

  const fetchBot = async () => {
    try {
      const { data } = await axios.get(`${API}/api/bots/${id}`, { headers: headers() });
      setBot(data.bot);
      setSettings({
        bot_name: data.bot.bot_name,
        client_name: data.bot.client_name,
        greeting_message: data.bot.greeting_message,
        primary_color: data.bot.primary_color,
        is_active: data.bot.is_active
      });
    } catch (err) {
      console.error(err);
    }
  };

  const fetchDocs = async () => {
    try {
      const { data } = await axios.get(`${API}/api/documents/${id}`, { headers: headers() });
      setDocs(data.documents);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchStats = async () => {
    try {
      const { data } = await axios.get(`${API}/api/analytics/${id}`, { headers: headers() });
      setStats(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSessions = async () => {
    try {
      const { data } = await axios.get(`${API}/api/conversations/${id}`, { headers: headers() });
      setSessions(data.sessions || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchLeads = async () => {
    try {
      const { data } = await axios.get(`${API}/api/leads/${id}`, { headers: headers() });
      setLeads(data.leads || []);
    } catch (err) {
      console.error(err);
    }
  };

  const viewThread = async (sessionId) => {
    setSelectedSession(sessionId);
    setLoadingThread(true);
    try {
      const { data } = await axios.get(`${API}/api/conversations/${id}/${sessionId}`, { headers: headers() });
      setThreadMessages(data.messages || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingThread(false);
    }
  };

  const deleteLead = async (leadId) => {
    try {
      await axios.delete(`${API}/api/leads/${id}/${leadId}`, { headers: headers() });
      setLeads(prev => prev.filter(l => l.id !== leadId));
    } catch (err) {
      console.error(err);
    }
  };

  const [msgType, setMsgType] = useState('success');
  const showMsg = (text, type = 'success') => {
    setMessage(text);
    setMsgType(type);
    setTimeout(() => setMessage(''), 4000);
  };

  // --- Bot Settings ---
  const saveSettings = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await axios.put(`${API}/api/bots/${id}`, settings, { headers: headers() });
      setBot(data.bot);
      showMsg('Settings saved!');
    } catch (err) {
      showMsg('Error saving settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  // --- Knowledge Base ---
  const uploadPdf = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { showMsg('File too large. Max 10MB.', 'error'); return; }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await axios.post(`${API}/api/documents/${id}/upload`, formData, {
        headers: { ...headers(), 'Content-Type': 'multipart/form-data' }
      });
      showMsg('PDF uploaded and learned!');
      fetchDocs();
      fetchStats();
    } catch (err) {
      showMsg(err.response?.data?.error || 'Error uploading PDF', 'error');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const addText = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setUploading(true);
    try {
      await axios.post(`${API}/api/documents/${id}/text`, { content: text }, { headers: headers() });
      setText('');
      showMsg('Text learned successfully!');
      fetchDocs();
      fetchStats();
    } catch (err) {
      showMsg('Error adding text', 'error');
    } finally {
      setUploading(false);
    }
  };

  const addUrl = async (e) => {
    e.preventDefault();
    if (!url.trim()) return;
    setUploading(true);
    try {
      await axios.post(`${API}/api/documents/${id}/url`, { url }, { headers: headers() });
      setUrl('');
      showMsg('URL scraped and learned!');
      fetchDocs();
      fetchStats();
    } catch (err) {
      showMsg('Error scraping URL', 'error');
    } finally {
      setUploading(false);
    }
  };

  const deleteDoc = async (docId) => {
    try {
      await axios.delete(`${API}/api/documents/${id}/${docId}`, { headers: headers() });
      fetchDocs();
      fetchStats();
    } catch (err) {
      console.error(err);
    }
  };

  // --- Test Chat ---
  const testChat = async (e) => {
    e.preventDefault();
    if (!testMsg.trim()) return;
    const userMsg = testMsg;
    setTestMsg('');
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setTesting(true);
    try {
      const { data } = await axios.post(`${API}/api/chat/${id}`, {
        message: userMsg,
        session_id: 'dashboard-test'
      });
      setChatMessages(prev => [...prev, { role: 'bot', text: data.reply }]);
    } catch (err) {
      setChatMessages(prev => [...prev, { role: 'bot', text: 'Error testing bot' }]);
    } finally {
      setTesting(false);
    }
  };

  // --- Embed Code ---
  const widgetUrl = `${API}/widget.js`;
  const embedCode = `<script src="${widgetUrl}" data-bot-id="${id}" data-api-url="${API}"></script>`;

  if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center"><div className="text-white">Loading...</div></div>;

  if (!bot) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center">
        <div className="text-white text-xl mb-4">Bot not found</div>
        <button onClick={() => router.push('/dashboard')} className="text-blue-400 hover:text-blue-300">Back to Dashboard</button>
      </div>
    </div>
  );

  const tabs = [
    { key: 'settings', label: 'Settings' },
    { key: 'knowledge', label: 'Knowledge' },
    { key: 'conversations', label: `Inbox (${sessions.length})` },
    { key: 'leads', label: `Leads (${leads.length})` },
    { key: 'embed', label: 'Embed' },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="border-b border-gray-800 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/dashboard')} className="text-gray-400 hover:text-white">← Back</button>
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ background: bot.primary_color }}>{bot.bot_name[0]}</div>
          <div>
            <div className="font-semibold">{bot.bot_name}</div>
            <div className="text-gray-400 text-xs">{bot.client_name}</div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Status message */}
        {message && <div className={`${msgType === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-green-500/10 border-green-500/20 text-green-400'} border rounded-lg p-3 mb-6 text-sm`}>{message}</div>}

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <div className="text-2xl font-bold">{stats.total_messages}</div>
            <div className="text-gray-400 text-sm mt-1">Messages</div>
          </div>
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <div className="text-2xl font-bold">{stats.total_conversations}</div>
            <div className="text-gray-400 text-sm mt-1">Conversations</div>
          </div>
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <div className="text-2xl font-bold">{stats.total_documents}</div>
            <div className="text-gray-400 text-sm mt-1">Documents</div>
          </div>
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <div className="text-2xl font-bold">{leads.length}</div>
            <div className="text-gray-400 text-sm mt-1">Leads</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-900 rounded-lg p-1 border border-gray-800">
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${activeTab === tab.key ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Two-column grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left column — Tab content */}
          <div className="space-y-6">

            {/* Bot Settings Tab */}
            {activeTab === 'settings' && (
              <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
                <h2 className="font-semibold mb-4">Bot Settings</h2>
                <form onSubmit={saveSettings} className="space-y-3">
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">Bot Name</label>
                    <input type="text" value={settings.bot_name || ''} onChange={e => setSettings({ ...settings, bot_name: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" required />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">Client Name</label>
                    <input type="text" value={settings.client_name || ''} onChange={e => setSettings({ ...settings, client_name: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" required />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">Greeting Message</label>
                    <input type="text" value={settings.greeting_message || ''} onChange={e => setSettings({ ...settings, greeting_message: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <label className="text-gray-400 text-xs mb-1 block">Brand Color</label>
                      <input type="color" value={settings.primary_color || '#000000'} onChange={e => setSettings({ ...settings, primary_color: e.target.value })} className="w-full h-10 bg-gray-800 border border-gray-700 rounded-lg cursor-pointer" />
                    </div>
                    <div className="flex items-center gap-2 pt-4">
                      <label className="text-gray-400 text-xs">Active</label>
                      <button type="button" onClick={() => setSettings({ ...settings, is_active: !settings.is_active })} className={`w-10 h-6 rounded-full transition-all ${settings.is_active ? 'bg-green-500' : 'bg-gray-600'}`}>
                        <div className={`w-4 h-4 bg-white rounded-full transition-all mx-1 ${settings.is_active ? 'translate-x-4' : ''}`} />
                      </button>
                    </div>
                  </div>
                  <button type="submit" disabled={saving} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                    {saving ? 'Saving...' : 'Save Settings'}
                  </button>
                </form>
              </div>
            )}

            {/* Knowledge Base Tab */}
            {activeTab === 'knowledge' && (
              <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
                <h2 className="font-semibold mb-4">Knowledge Base</h2>

                {/* PDF Upload */}
                <div className="mb-4">
                  <label className="text-gray-400 text-xs mb-2 block">Upload PDF</label>
                  <input ref={fileInputRef} type="file" accept=".pdf" onChange={uploadPdf} className="hidden" />
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="w-full bg-gray-800 border border-gray-700 border-dashed rounded-lg px-4 py-3 text-gray-400 text-sm hover:border-blue-500 hover:text-blue-400 transition-all disabled:opacity-50">
                    {uploading ? 'Uploading...' : 'Click to upload PDF (max 10MB)'}
                  </button>
                </div>

                {/* Text input */}
                <form onSubmit={addText} className="mb-4">
                  <label className="text-gray-400 text-xs mb-2 block">Add Text</label>
                  <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Paste your FAQ, services, pricing, hours..." className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 h-24 resize-none text-sm" />
                  <button type="submit" disabled={uploading} className="mt-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50">
                    {uploading ? 'Learning...' : 'Add Text'}
                  </button>
                </form>

                {/* URL input */}
                <form onSubmit={addUrl}>
                  <label className="text-gray-400 text-xs mb-2 block">Scrape Website URL</label>
                  <div className="flex gap-2">
                    <input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://clientwebsite.com" className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm" />
                    <button type="submit" disabled={uploading} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50">
                      {uploading ? '...' : 'Scrape'}
                    </button>
                  </div>
                </form>

                {/* Document list */}
                {docs.length > 0 && (
                  <div className="mt-4">
                    <div className="text-gray-400 text-xs mb-2">Learned Documents ({docs.length})</div>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
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
            )}

            {/* Conversations Inbox Tab */}
            {activeTab === 'conversations' && (
              <div className="bg-gray-900 rounded-xl border border-gray-800 flex flex-col" style={{ minHeight: '500px' }}>
                {!selectedSession ? (
                  <>
                    <div className="p-4 border-b border-gray-800">
                      <h2 className="font-semibold">Conversation Inbox</h2>
                      <p className="text-gray-500 text-xs mt-1">View past conversations from your widget visitors.</p>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                      {sessions.length === 0 ? (
                        <div className="p-8 text-center text-gray-500 text-sm">No conversations yet.</div>
                      ) : (
                        <div className="divide-y divide-gray-800">
                          {sessions.map(s => (
                            <button key={s.session_id} onClick={() => viewThread(s.session_id)} className="w-full text-left px-4 py-3 hover:bg-gray-800/50 transition-all">
                              <div className="flex justify-between items-start">
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium truncate">{s.preview || 'No messages'}</div>
                                  <div className="text-gray-500 text-xs mt-1">{s.message_count} messages</div>
                                </div>
                                <div className="text-gray-500 text-xs ml-3 whitespace-nowrap">
                                  {new Date(s.last_message_at).toLocaleDateString()}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="p-4 border-b border-gray-800 flex items-center gap-3">
                      <button onClick={() => { setSelectedSession(null); setThreadMessages([]); }} className="text-gray-400 hover:text-white text-sm">← Back</button>
                      <div>
                        <h2 className="font-semibold text-sm">Conversation</h2>
                        <div className="text-gray-500 text-xs">{selectedSession}</div>
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                      {loadingThread ? (
                        <div className="text-gray-500 text-sm">Loading...</div>
                      ) : (
                        threadMessages.map((msg, i) => (
                          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`rounded-lg px-3 py-2 text-sm max-w-[80%] whitespace-pre-wrap ${msg.role === 'user' ? 'bg-blue-600' : 'bg-gray-700'}`}>
                              {msg.message}
                              <div className="text-[10px] opacity-50 mt-1">{new Date(msg.created_at).toLocaleTimeString()}</div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Leads Tab */}
            {activeTab === 'leads' && (
              <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
                <h2 className="font-semibold mb-2">Captured Leads</h2>
                <p className="text-gray-500 text-xs mb-4">Visitors who submitted their info before chatting with your bot.</p>
                {leads.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 text-sm">No leads captured yet. The widget will ask visitors for their info before chatting.</div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {leads.map(lead => (
                      <div key={lead.id} className="bg-gray-800 rounded-lg px-4 py-3 flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium">{lead.name || 'Anonymous'}</div>
                          <div className="text-gray-400 text-xs flex gap-3 mt-1">
                            {lead.email && <span>{lead.email}</span>}
                            {lead.phone && <span>{lead.phone}</span>}
                          </div>
                          <div className="text-gray-500 text-xs mt-1">{new Date(lead.created_at).toLocaleString()}</div>
                        </div>
                        <button onClick={() => deleteLead(lead.id)} className="text-red-400 hover:text-red-300 text-xs ml-3">Delete</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Embed Code Tab */}
            {activeTab === 'embed' && (
              <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
                <h2 className="font-semibold mb-3">Embed Code</h2>
                <p className="text-gray-400 text-sm mb-3">Paste this before the closing body tag on your client{"'"}s website.</p>
                <div className="bg-gray-800 rounded-lg p-3 font-mono text-xs text-green-400 break-all">{embedCode}</div>
                <button onClick={() => { navigator.clipboard.writeText(embedCode); showMsg('Copied!'); }} className="mt-3 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm">Copy Code</button>
              </div>
            )}
          </div>

          {/* Right column — Test Chat */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 flex flex-col" style={{ minHeight: '600px' }}>
            <div className="p-4 border-b border-gray-800">
              <h2 className="font-semibold">Test Your Bot</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatMessages.length === 0 && <div className="text-gray-500 text-sm">Ask your bot something to test it...</div>}
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`rounded-lg px-3 py-2 text-sm max-w-[80%] whitespace-pre-wrap ${msg.role === 'user' ? 'bg-blue-600' : 'bg-gray-700'}`}>{msg.text}</div>
                </div>
              ))}
              {testing && (
                <div className="flex justify-start">
                  <div className="bg-gray-700 rounded-lg px-3 py-2 text-sm text-gray-400">Thinking...</div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <form onSubmit={testChat} className="p-4 border-t border-gray-800 flex gap-2">
              <input type="text" value={testMsg} onChange={e => setTestMsg(e.target.value)} placeholder="Ask your bot something..." className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm" />
              <button type="submit" disabled={testing} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50">Send</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
