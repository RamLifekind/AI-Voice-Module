import React, { useState, useEffect, useCallback } from 'react';
import {
  LogIn, LogOut, MessageSquare, Stethoscope, Calendar, TestTube2,
  User, Copy, CheckCircle, Shield, Clock, Mic, Loader
} from 'lucide-react';
import { OAUTH_CONFIG, API_BASE, TEST_DATA, WELCOME_QUESTIONS, INSIDE_SCRUM_QUESTIONS, OUTSIDE_SCRUM_QUESTIONS, SYNTHETIC_PATIENTS } from './config';
import ChatBox from './components/ChatBox';
import VoiceAgentTester from './components/VoiceAgentTester';

const TABS = [
  { id: 'welcome', label: 'Welcome Chat', icon: MessageSquare, color: 'blue' },
  { id: 'inside_scrum', label: 'Inside Scrum', icon: Stethoscope, color: 'green' },
  { id: 'outside_scrum', label: 'Outside Scrum', icon: Calendar, color: 'purple' },
  { id: 'ai_job', label: 'AI Job Tester', icon: TestTube2, color: 'orange' },
  { id: 'voice_agent', label: 'Voice Agent', icon: Mic, color: 'red' },
];

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('access_token'));
  const [refreshToken, setRefreshToken] = useState(() => localStorage.getItem('refresh_token'));
  const [tokenInfo, setTokenInfo] = useState(null);
  const [activeTab, setActiveTab] = useState('welcome');
  const [copied, setCopied] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [selectedPatient, setSelectedPatient] = useState({
    patientId: 3001,
    patientName: 'Gilian Negata',
  });
  const [aiJobLoading, setAiJobLoading] = useState(false);
  const [aiJobResult, setAiJobResult] = useState(null);
  const [aiJobAllLoading, setAiJobAllLoading] = useState(false);
  const [aiJobAllResult, setAiJobAllResult] = useState(null);
  const [aiJobPatientId, setAiJobPatientId] = useState(3001);

  // Parse JWT payload
  const parseToken = useCallback((accessToken) => {
    try {
      const payload = JSON.parse(atob(accessToken.split('.')[1]));
      setTokenInfo({
        name: payload.name,
        upn: payload.upn || payload.preferred_username,
        oid: payload.oid,
        exp: new Date(payload.exp * 1000).toLocaleString(),
        aud: payload.aud,
        expTimestamp: payload.exp,
      });
      return payload;
    } catch (e) {
      console.error('Failed to parse token:', e);
      return null;
    }
  }, []);

  // Check for OAuth callback result in URL on mount
  useEffect(() => {
    const url = new URL(window.location.href);
    const error = url.searchParams.get('error');
    const authSuccess = url.searchParams.get('auth_success');

    if (error) {
      setAuthError(url.searchParams.get('error_description') || error);
      window.history.replaceState({}, document.title, '/');
      return;
    }

    if (authSuccess) {
      // Tokens received from setupProxy callback handler
      try {
        const data = JSON.parse(decodeURIComponent(authSuccess));
        localStorage.setItem('access_token', data.accessToken);
        if (data.refreshToken) {
          localStorage.setItem('refresh_token', data.refreshToken);
          setRefreshToken(data.refreshToken);
        }
        setToken(data.accessToken);
        parseToken(data.accessToken);
        setAuthError(null);
        console.log('Login successful');
      } catch (e) {
        setAuthError('Failed to parse auth response');
      }
      window.history.replaceState({}, document.title, '/');
      return;
    }

    // If we have a stored token, parse it
    if (token) {
      const payload = parseToken(token);
      if (payload && payload.exp * 1000 < Date.now()) {
        if (refreshToken) {
          refreshAccessToken();
        } else {
          handleLogout();
        }
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Refresh expired access token via setupProxy endpoint
  const refreshAccessToken = async () => {
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      const data = await response.json();

      if (!data.success) {
        handleLogout();
        return;
      }

      localStorage.setItem('access_token', data.accessToken);
      if (data.refreshToken) {
        localStorage.setItem('refresh_token', data.refreshToken);
        setRefreshToken(data.refreshToken);
      }
      setToken(data.accessToken);
      parseToken(data.accessToken);
    } catch (error) {
      console.error('Token refresh failed:', error);
      handleLogout();
    }
  };

  // Redirect to Microsoft login
  const handleLogin = () => {
    const params = new URLSearchParams({
      client_id: OAUTH_CONFIG.clientId,
      response_type: 'code',
      redirect_uri: OAUTH_CONFIG.redirectUri,
      scope: OAUTH_CONFIG.scope,
      response_mode: 'query',
      prompt: 'select_account',
    });

    window.location.href = `${OAUTH_CONFIG.authorizeUrl}?${params.toString()}`;
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setToken(null);
    setRefreshToken(null);
    setTokenInfo(null);
  };

  const copyToken = () => {
    if (token) {
      navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // AI Job test functions
  const runAiJobSingle = async () => {
    setAiJobLoading(true);
    setAiJobResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/ai-batch/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ patientId: aiJobPatientId }),
      });
      const data = await res.json();
      setAiJobResult(data);
    } catch (err) {
      setAiJobResult({ success: false, message: err.message });
    } finally {
      setAiJobLoading(false);
    }
  };

  const runAiJobAll = async () => {
    setAiJobAllLoading(true);
    setAiJobAllResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/ai-batch/test-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setAiJobAllResult(data);
    } catch (err) {
      setAiJobAllResult({ success: false, message: err.message });
    } finally {
      setAiJobAllLoading(false);
    }
  };

  const isAuthenticated = !!token && !!tokenInfo;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Bar */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Stethoscope className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-800">FOCUS UTC Tester</h1>
              <p className="text-xs text-gray-500">Backend API & AI Chat Testing</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <>
                <div className="text-right hidden sm:block">
                  <div className="text-sm font-medium text-gray-700">{tokenInfo.name}</div>
                  <div className="text-xs text-gray-400">{tokenInfo.upn}</div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={copyToken}
                    title="Copy JWT token"
                    className="flex items-center gap-1 px-2 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                  >
                    {copied ? <CheckCircle className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied!' : 'JWT'}
                  </button>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs bg-red-50 text-red-600 hover:bg-red-100 rounded transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign Out
                  </button>
                </div>
              </>
            ) : (
              <button
                onClick={handleLogin}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <LogIn className="w-4 h-4" />
                Sign in with Microsoft
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Auth Error Banner */}
      {authError && (
        <div className="bg-red-50 border-b border-red-200">
          <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-3 text-xs">
            <span className="text-red-700 font-medium">Auth Error:</span>
            <span className="text-red-600">{authError}</span>
            <button
              onClick={() => setAuthError(null)}
              className="ml-auto text-red-400 hover:text-red-600"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Token Info Banner */}
      {isAuthenticated && (
        <div className="bg-green-50 border-b border-green-200">
          <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-4 text-xs">
            <Shield className="w-4 h-4 text-green-600" />
            <span className="text-green-700 font-medium">Authenticated</span>
            <span className="text-green-600">OID: {tokenInfo.oid?.substring(0, 8)}...</span>
            <span className="text-green-600">Audience: {tokenInfo.aud?.substring(0, 20)}...</span>
            <div className="flex items-center gap-1 text-green-600">
              <Clock className="w-3 h-3" />
              Expires: {tokenInfo.exp}
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4">
          <nav className="flex gap-1">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? `border-${tab.color}-600 text-${tab.color}-600`
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'welcome' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <ChatBox
                token={token}
                context="welcome"
                title="Welcome - FOCUS AI Assistant"
                placeholder="Ask about today's schedule, patients, or clinical data..."
                suggestedQuestions={WELCOME_QUESTIONS}
                enableVoice={true}
              />
            </div>
            <div className="space-y-4">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-blue-600" />
                  Welcome Screen Context
                </h3>
                <p className="text-sm text-gray-600 mb-3">
                  This chatbox simulates the provider's landing page after login. It can:
                </p>
                <ul className="text-sm text-gray-500 space-y-1.5">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-0.5">&#8226;</span>
                    Show today's patient schedule across all units
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-0.5">&#8226;</span>
                    Identify new intakes and non-English speakers
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-0.5">&#8226;</span>
                    Flag unreviewed labs, UDS, and imaging
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-0.5">&#8226;</span>
                    Surface at-risk patients (PHQ-9 scores)
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-0.5">&#8226;</span>
                    Preview confirmed procedures for the day
                  </li>
                </ul>
              </div>
              <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">
                <h4 className="text-sm font-medium text-blue-800 mb-1">Data Source</h4>
                <p className="text-xs text-blue-600">
                  Uses synthetic placeholder data in <code>chat.repository.js</code>.
                  8 sample patients, schedules, labs, UDS, PHQ-9, imaging, and care actions.
                  Will switch to real DB when SPs are ready.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'inside_scrum' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <ChatBox
                token={token}
                context="inside_scrum"
                contextData={{
                  patientId: selectedPatient.patientId,
                  patientName: selectedPatient.patientName,
                  unitId: 1,
                }}
                title="Inside Scrum - Patient AI Assistant"
                placeholder={`Ask about ${selectedPatient.patientName}...`}
                suggestedQuestions={INSIDE_SCRUM_QUESTIONS}
              />
            </div>
            <div className="space-y-4">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <Stethoscope className="w-4 h-4 text-green-600" />
                  Inside Scrum Context
                </h3>
                <p className="text-sm text-gray-600 mb-3">
                  Active during scrum with a specific patient selected. Text-only — no voice chat (WebSocket is running for speaker identification).
                </p>

                {/* Patient Selector */}
                <div className="mb-3">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Select Patient</label>
                  <select
                    value={selectedPatient.patientId}
                    onChange={(e) => {
                      const p = SYNTHETIC_PATIENTS.find(sp => sp.id === Number(e.target.value));
                      setSelectedPatient({
                        patientId: Number(e.target.value),
                        patientName: p?.name || '',
                      });
                    }}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                  >
                    {SYNTHETIC_PATIENTS.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {p.diagnosis.split(',')[0]}
                      </option>
                    ))}
                  </select>
                </div>

                <ul className="text-sm text-gray-500 space-y-1.5">
                  <li className="flex items-start gap-2">
                    <span className="text-green-400 mt-0.5">&#8226;</span>
                    Patient synopsis with diagnosis and GHS scores
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-400 mt-0.5">&#8226;</span>
                    UDS, lab results, and PHQ-9 assessments
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-400 mt-0.5">&#8226;</span>
                    Care action review and suggestions
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-400 mt-0.5">&#8226;</span>
                    Imaging and report links
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-400 mt-0.5">&#8226;</span>
                    Draft patient education content (marked DRAFT)
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'outside_scrum' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <ChatBox
                token={token}
                context="outside_scrum"
                contextData={{
                  patientId: selectedPatient.patientId,
                  patientName: selectedPatient.patientName,
                  unitId: 1,
                }}
                title="Outside Scrum - Patient Voice Assistant"
                placeholder={`Ask about ${selectedPatient.patientName}...`}
                suggestedQuestions={OUTSIDE_SCRUM_QUESTIONS}
                enableVoice={true}
              />
            </div>
            <div className="space-y-4">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-purple-600" />
                  Outside Scrum Context
                </h3>
                <p className="text-sm text-gray-600 mb-3">
                  1-on-1 session with a patient outside the scrum. Voice chat enabled — WebSocket is free (no scrum running).
                </p>

                {/* Patient Selector */}
                <div className="mb-3">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Select Patient</label>
                  <select
                    value={selectedPatient.patientId}
                    onChange={(e) => {
                      const p = SYNTHETIC_PATIENTS.find(sp => sp.id === Number(e.target.value));
                      setSelectedPatient({
                        patientId: Number(e.target.value),
                        patientName: p?.name || '',
                      });
                    }}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                  >
                    {SYNTHETIC_PATIENTS.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {p.diagnosis.split(',')[0]}
                      </option>
                    ))}
                  </select>
                </div>

                <ul className="text-sm text-gray-500 space-y-1.5">
                  <li className="flex items-start gap-2">
                    <span className="text-purple-400 mt-0.5">&#8226;</span>
                    Voice-enabled patient queries (mic button)
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-400 mt-0.5">&#8226;</span>
                    Patient synopsis, diagnosis, GHS scores
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-400 mt-0.5">&#8226;</span>
                    UDS, labs, PHQ-9 assessments
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-400 mt-0.5">&#8226;</span>
                    Imaging reports and findings
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-400 mt-0.5">&#8226;</span>
                    AI reads responses aloud (TTS)
                  </li>
                </ul>
              </div>
              <div className="bg-purple-50 rounded-xl border border-purple-200 p-4">
                <h4 className="text-sm font-medium text-purple-800 mb-1">Voice Chat</h4>
                <p className="text-xs text-purple-600">
                  Uses Azure STT (backend) and Azure TTS (Opus codec).
                  Only the latest AI response audio plays — previous audio is stopped automatically.
                  Inside Scrum has no voice since WebSocket is active for speaker identification.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'ai_job' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Single Patient Test */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <TestTube2 className="w-5 h-5 text-orange-600" />
                AI Batch — Single Patient
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                Generate AI scrum content (presentation, encounter prep, last visit summary, trends, care action suggestions) for one synthetic patient.
              </p>
              <div className="mb-4">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Select Patient</label>
                <select
                  value={aiJobPatientId}
                  onChange={(e) => setAiJobPatientId(Number(e.target.value))}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500"
                >
                  {SYNTHETIC_PATIENTS.map(p => (
                    <option key={p.id} value={p.id}>{p.name} (ID: {p.id}) — {p.diagnosis.split(',')[0]}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={runAiJobSingle}
                disabled={aiJobLoading || !token}
                className="w-full px-4 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {aiJobLoading ? <><Loader className="w-4 h-4 animate-spin" /> Generating...</> : 'Run AI Batch (Single)'}
              </button>
              {aiJobResult && (
                <div className="mt-4">
                  <div className={`text-xs font-medium mb-2 ${aiJobResult.success ? 'text-green-600' : 'text-red-600'}`}>
                    {aiJobResult.success ? 'Success' : `Error: ${aiJobResult.message}`}
                  </div>
                  {aiJobResult.success && aiJobResult.data && (
                    <pre className="text-xs bg-gray-50 border border-gray-200 rounded-lg p-3 overflow-auto max-h-[400px] whitespace-pre-wrap">
                      {JSON.stringify(aiJobResult.data, null, 2)}
                    </pre>
                  )}
                </div>
              )}
            </div>

            {/* All Patients Test */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <TestTube2 className="w-5 h-5 text-orange-600" />
                AI Batch — All Patients
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                Generate AI scrum content for all synthetic patients (3001, 3002, 3003, 3005). Takes ~30 seconds.
              </p>
              <div className="mb-4 bg-orange-50 rounded-lg p-3 border border-orange-200">
                <p className="text-xs text-orange-700">
                  <strong>Patients:</strong> {SYNTHETIC_PATIENTS.filter(p => [3001,3002,3003,3005].includes(p.id)).map(p => p.name).join(', ')}
                </p>
              </div>
              <button
                onClick={runAiJobAll}
                disabled={aiJobAllLoading || !token}
                className="w-full px-4 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {aiJobAllLoading ? <><Loader className="w-4 h-4 animate-spin" /> Generating all...</> : 'Run AI Batch (All Patients)'}
              </button>
              {aiJobAllResult && (
                <div className="mt-4">
                  <div className={`text-xs font-medium mb-2 ${aiJobAllResult.success ? 'text-green-600' : 'text-red-600'}`}>
                    {aiJobAllResult.success
                      ? `Success — ${aiJobAllResult.summary?.succeeded || 0}/${aiJobAllResult.summary?.total || 0} patients`
                      : `Error: ${aiJobAllResult.message}`}
                  </div>
                  {aiJobAllResult.success && (
                    <pre className="text-xs bg-gray-50 border border-gray-200 rounded-lg p-3 overflow-auto max-h-[400px] whitespace-pre-wrap">
                      {JSON.stringify(aiJobAllResult.results || aiJobAllResult.data, null, 2)}
                    </pre>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'voice_agent' && (
          <VoiceAgentTester token={token} />
        )}
      </main>
    </div>
  );
}
