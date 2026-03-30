import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Activity, Loader, Send, Volume2, VolumeX, Wifi, WifiOff } from 'lucide-react';
import { VOICE_BACKEND, TEST_DATA } from '../config';

const WS_BASE = VOICE_BACKEND.replace('https://', 'wss://');

// Preset init configs from API_ENDPOINTS.md
const PRESETS = {
  pre_scrum: {
    type: 'init',
    mode: 'pre_scrum',
    unitId: '7E5A477F-5931-4640-8384-2779BA778BD0',
    locationId: '543F323C-97C9-4419-88D6-0E1E832CDC7E',
    scrumSessionId: '338D549F-2E9F-4B6B-BF54-82DD3E218C4A',
    unitSequence: 1,
    locationName: 'Riverside',
    patientId: null,
  },
  scrum: {
    type: 'init',
    mode: 'scrum',
    unitId: '7E5A477F-5931-4640-8384-2779BA778BD0',
    locationId: '543F323C-97C9-4419-88D6-0E1E832CDC7E',
    scrumSessionId: '338D549F-2E9F-4B6B-BF54-82DD3E218C4A',
    unitSequence: 1,
    locationName: 'Riverside',
    patientId: '17849590-2D86-4843-B9CC-CD5A52B0C282',
  },
  set_patient: {
    type: 'set_patient',
    patientId: 'A4B8A2A3-36BE-4EE2-92AC-6B5C229A596A',
  },
};

async function getVoiceWsTicket(token) {
  const res = await fetch(`${VOICE_BACKEND}/api/ws/ticket`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!data.ticket) throw new Error(data.message || `Ticket failed (${res.status})`);
  return data.ticket;
}

export default function WebSocketInitTester({ token }) {
  const [status, setStatus] = useState('disconnected'); // disconnected, connecting, connected, error
  const [logs, setLogs] = useState([]);
  const [initMode, setInitMode] = useState('pre_scrum');
  const [customJson, setCustomJson] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [isRecording, setIsRecording] = useState(false);

  const wsRef = useRef(null);
  const currentAudioRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const logsEndRef = useRef(null);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const addLog = useCallback((message, type = 'info') => {
    const ts = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 });
    setLogs(prev => [...prev, { ts, message, type }]);
  }, []);

  // Convert base64 to Blob (matches VoiceAgentTester pattern)
  const base64ToBlob = (base64, mimeType) => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  };

  // Play base64 audio via HTML Audio element (matches working VoiceAgentTester)
  const playBase64Audio = useCallback((base64Audio, source = 'TTS') => {
    if (!audioEnabled) {
      addLog(`Audio playback disabled — skipping ${source}`, 'info');
      return;
    }
    try {
      // Stop any currently playing audio
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }

      // Try audio/wav first (Azure default Riff16Khz16BitMonoPcm)
      const audioBlob = base64ToBlob(base64Audio, 'audio/wav');
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      currentAudioRef.current = audio;

      audio.oncanplaythrough = () => {
        addLog(`Playing ${source} audio...`, 'audio');
      };

      audio.onended = () => {
        addLog(`${source} audio finished`, 'audio');
        URL.revokeObjectURL(audioUrl);
        currentAudioRef.current = null;
      };

      audio.onerror = (e) => {
        addLog(`${source} audio/wav failed (${audio.error?.code || 'unknown'}), trying audio/mpeg...`, 'error');
        URL.revokeObjectURL(audioUrl);

        // Fallback: try as audio/mpeg
        const fallbackBlob = base64ToBlob(base64Audio, 'audio/mpeg');
        const fallbackUrl = URL.createObjectURL(fallbackBlob);
        const fallbackAudio = new Audio(fallbackUrl);
        currentAudioRef.current = fallbackAudio;

        fallbackAudio.onended = () => {
          URL.revokeObjectURL(fallbackUrl);
          currentAudioRef.current = null;
        };
        fallbackAudio.onerror = () => {
          addLog(`${source} audio playback failed on all formats`, 'error');
          URL.revokeObjectURL(fallbackUrl);
          currentAudioRef.current = null;
        };

        fallbackAudio.play().catch(err => {
          addLog(`${source} fallback play() error: ${err.message}`, 'error');
        });
      };

      audio.play().catch(err => {
        addLog(`${source} play() error: ${err.message} — may need user interaction first`, 'error');
      });
    } catch (e) {
      addLog(`Audio playback error: ${e.message}`, 'error');
    }
  }, [audioEnabled, addLog]);

  const connect = useCallback(async () => {
    if (!token) {
      addLog('No auth token — sign in first', 'error');
      return;
    }

    setStatus('connecting');
    addLog('Fetching WebSocket ticket...', 'info');

    try {
      const ticket = await getVoiceWsTicket(token);
      addLog(`Ticket received: ${ticket.substring(0, 8)}...`, 'success');

      const wsUrl = `${WS_BASE}/meeting?ticket=${ticket}`;
      addLog(`Connecting to ${wsUrl.substring(0, 60)}...`, 'info');

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus('connected');
        addLog('WebSocket connected', 'success');
        addLog('Ready to send init message. Click "Send Pre-Scrum Init" or "Send Scrum Init".', 'info');
      };

      ws.onmessage = async (event) => {
        // Binary blob fallback (unlikely but handle it)
        if (event.data instanceof Blob) {
          addLog(`Received binary blob (${(event.data.size / 1024).toFixed(1)} KB)`, 'audio');
          return;
        }

        try {
          const raw = typeof event.data === 'string' ? event.data : event.data.toString();
          const msg = JSON.parse(raw);
          const typeLabel = msg.type || msg.event || 'unknown';

          addLog(`[WS MSG] type=${typeLabel}, keys=${Object.keys(msg).join(',')}`, 'info');

          // TTS audio messages — base64 audio in JSON (main audio delivery)
          if (msg.type === 'tts_audio') {
            const audioData = msg.audio || msg.audioBase64;
            if (audioData) {
              addLog(`TTS Audio: text="${(msg.text || '').substring(0, 60)}..." isWelcome=${msg.isWelcome} providerId=${msg.providerId}`, 'success');
              addLog(`TTS Audio: ${audioData.length} chars base64 (~${(audioData.length * 0.75 / 1024).toFixed(0)} KB audio)`, 'audio');
              playBase64Audio(audioData, msg.isWelcome ? 'Welcome' : 'TTS');
            } else {
              addLog(`TTS Audio message but no audio field! Keys: ${Object.keys(msg).join(', ')}`, 'error');
            }
          } else if (msg.type === 'tts_summary') {
            const audioData = msg.audio || msg.audioBase64;
            if (audioData) {
              addLog(`TTS Summary audio received (${audioData.length} chars)`, 'audio');
              playBase64Audio(audioData, 'Summary');
            } else {
              addLog(`TTS Summary — no audio field. Keys: ${Object.keys(msg).join(', ')}`, 'error');
            }
          } else if (msg.type === 'welcome') {
            addLog(`WELCOME: "${msg.text || msg.message || JSON.stringify(msg)}"`, 'success');
          } else if (msg.type === 'transcript') {
            addLog(`TRANSCRIPT: "${msg.text}" (speaker: ${msg.speaker || 'unknown'}, conf: ${msg.confidence || 'N/A'})`, 'info');
          } else if (msg.type === 'speaker_verified') {
            addLog(`SPEAKER VERIFIED: ${msg.firstName || msg.name || 'unknown'}`, 'success');
          } else if (msg.type === 'attendance_marked') {
            addLog(`ATTENDANCE: ${msg.firstName || msg.name || 'unknown'} marked present`, 'success');
          } else if (msg.type === 'function_call') {
            addLog(`FUNCTION CALL: ${msg.name || msg.function || ''} ${msg.arguments ? JSON.stringify(msg.arguments) : ''}`, 'info');
          } else if (msg.type === 'function_result') {
            addLog(`FUNCTION RESULT: ${JSON.stringify(msg.result || msg).substring(0, 200)}`, 'info');
          } else if (msg.type === 'error') {
            addLog(`SERVER ERROR: ${msg.message || JSON.stringify(msg)}`, 'error');
          } else {
            addLog(`[${typeLabel}] ${JSON.stringify(msg).substring(0, 300)}`, 'info');
          }
        } catch {
          addLog(`Received text: ${event.data.substring(0, 200)}`, 'info');
        }
      };

      ws.onerror = (err) => {
        addLog(`WebSocket error: ${err.message || 'Connection error'}`, 'error');
        setStatus('error');
      };

      ws.onclose = (event) => {
        addLog(`WebSocket closed (code: ${event.code}, reason: ${event.reason || 'none'})`, event.code === 1000 ? 'info' : 'error');
        setStatus('disconnected');
        wsRef.current = null;
        stopRecording();
      };
    } catch (e) {
      addLog(`Connection failed: ${e.message}`, 'error');
      setStatus('error');
    }
  }, [token, addLog, playBase64Audio]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnected');
      wsRef.current = null;
    }
    stopRecording();
    setStatus('disconnected');
    addLog('Disconnected', 'info');
  }, [addLog]);

  const sendMessage = useCallback((msg) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      addLog('WebSocket not connected', 'error');
      return;
    }
    const json = typeof msg === 'string' ? msg : JSON.stringify(msg);
    wsRef.current.send(json);
    addLog(`SENT: ${json}`, 'sent');
  }, [addLog]);

  const sendInit = useCallback((mode) => {
    const preset = PRESETS[mode];
    sendMessage(preset);
    setInitMode(mode);
  }, [sendMessage]);

  const sendCustom = useCallback(() => {
    try {
      const parsed = JSON.parse(customJson);
      sendMessage(parsed);
    } catch {
      addLog('Invalid JSON in custom message', 'error');
    }
  }, [customJson, sendMessage, addLog]);

  // Microphone recording — raw PCM Int16 at 16kHz mono (matches production frontend)
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true }
      });
      mediaStreamRef.current = stream;

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioCtx({ sampleRate: 16000 });
      if (audioContext.state === 'suspended') await audioContext.resume();

      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);

      processor.onaudioprocess = (e) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        const input = e.inputBuffer.getChannelData(0);
        // Convert Float32 [-1, 1] to Int16 (same as production)
        const pcm16 = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) {
          const s = Math.max(-1, Math.min(1, input[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        wsRef.current.send(pcm16.buffer);
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      mediaRecorderRef.current = { processor, audioContext, source };
      setIsRecording(true);
      addLog('Microphone started (PCM 16kHz 16-bit mono → server)', 'info');
    } catch (e) {
      addLog(`Microphone error: ${e.message}`, 'error');
    }
  }, [addLog]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      const { processor, audioContext, source } = mediaRecorderRef.current;
      if (processor) processor.disconnect();
      if (source) source.disconnect();
      if (audioContext) audioContext.close();
      mediaRecorderRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
    setIsRecording(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) wsRef.current.close();
      stopRecording();
    };
  }, [stopRecording]);

  const statusColors = {
    disconnected: 'bg-gray-100 text-gray-600 border-gray-300',
    connecting: 'bg-yellow-100 text-yellow-700 border-yellow-300',
    connected: 'bg-green-100 text-green-700 border-green-300',
    error: 'bg-red-100 text-red-700 border-red-300',
  };

  const logColors = {
    info: 'text-gray-600',
    success: 'text-green-600',
    error: 'text-red-600',
    sent: 'text-blue-600',
    audio: 'text-purple-600',
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left — Controls */}
      <div className="space-y-4">
        {/* Connection Status */}
        <div className={`rounded-xl border p-4 ${statusColors[status]}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {status === 'connected' ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
              <span className="font-semibold capitalize">{status}</span>
            </div>
            {status === 'connecting' && <Loader className="w-4 h-4 animate-spin" />}
          </div>
        </div>

        {/* Connect / Disconnect */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-800 mb-3">1. Connect WebSocket</h3>
          <p className="text-xs text-gray-500 mb-3">
            Gets a ticket from voice backend, then opens WebSocket to <code className="bg-gray-100 px-1 rounded">wss://.../meeting</code>
          </p>
          {status === 'disconnected' || status === 'error' ? (
            <button
              onClick={connect}
              disabled={!token}
              className="w-full px-4 py-2.5 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              <Wifi className="w-4 h-4" /> Connect
            </button>
          ) : status === 'connecting' ? (
            <button disabled className="w-full px-4 py-2.5 bg-yellow-400 text-white rounded-lg flex items-center justify-center gap-2">
              <Loader className="w-4 h-4 animate-spin" /> Connecting...
            </button>
          ) : (
            <button
              onClick={disconnect}
              className="w-full px-4 py-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
            >
              <WifiOff className="w-4 h-4" /> Disconnect
            </button>
          )}
        </div>

        {/* Init Messages */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-800 mb-3">2. Send Init Message</h3>
          <p className="text-xs text-gray-500 mb-3">
            Send <code className="bg-gray-100 px-1 rounded">type: "init"</code> with mode preset. Without this: no welcome audio, no agent voice.
          </p>
          <div className="space-y-2">
            <button
              onClick={() => sendInit('pre_scrum')}
              disabled={status !== 'connected'}
              className="w-full px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" /> Send Pre-Scrum Init
            </button>
            <button
              onClick={() => sendInit('scrum')}
              disabled={status !== 'connected'}
              className="w-full px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" /> Send Scrum Init
            </button>
          </div>
        </div>

        {/* Update Patient */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-800 mb-3">3. Update Patient (In-Scrum)</h3>
          <p className="text-xs text-gray-500 mb-3">
            Send <code className="bg-gray-100 px-1 rounded">set_patient</code> to switch patient context mid-scrum.
          </p>
          <button
            onClick={() => sendInit('set_patient')}
            disabled={status !== 'connected'}
            className="w-full px-4 py-2.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4" /> Set Patient (Kenneth Jackson)
          </button>
        </div>

        {/* Microphone */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-800 mb-3">4. Microphone (Voice)</h3>
          <p className="text-xs text-gray-500 mb-3">
            Stream mic audio to server for voice recognition and Avery AI agent interaction.
          </p>
          <div className="flex gap-2">
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={status !== 'connected'}
              className={`flex-1 px-4 py-2.5 rounded-lg transition-colors text-sm flex items-center justify-center gap-2 ${
                isRecording
                  ? 'bg-red-500 text-white hover:bg-red-600 animate-pulse'
                  : 'bg-teal-600 text-white hover:bg-teal-700 disabled:bg-gray-300 disabled:cursor-not-allowed'
              }`}
            >
              {isRecording ? (
                <><Activity className="w-4 h-4" /> Stop Recording</>
              ) : (
                <><Activity className="w-4 h-4" /> Start Mic</>
              )}
            </button>
            <button
              onClick={() => setAudioEnabled(!audioEnabled)}
              className={`px-3 py-2.5 rounded-lg transition-colors ${audioEnabled ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-400'}`}
              title={audioEnabled ? 'Audio playback ON' : 'Audio playback OFF'}
            >
              {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Custom JSON */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-800 mb-2">Send Custom JSON</h3>
          <textarea
            value={customJson}
            onChange={(e) => setCustomJson(e.target.value)}
            placeholder='{"type": "...", ...}'
            className="w-full h-20 px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-cyan-500 resize-none"
          />
          <button
            onClick={sendCustom}
            disabled={status !== 'connected' || !customJson.trim()}
            className="mt-2 w-full px-3 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4" /> Send Custom
          </button>
        </div>
      </div>

      {/* Right — Logs & Preset Display */}
      <div className="lg:col-span-2 space-y-4">
        {/* Current Preset Preview */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-gray-800">Init Message Presets</h3>
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${
              initMode === 'pre_scrum' ? 'bg-indigo-100 text-indigo-700' : initMode === 'scrum' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
            }`}>
              {initMode}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {Object.entries(PRESETS).map(([key, preset]) => (
              <div key={key} className={`rounded-lg border p-3 ${initMode === key ? 'border-cyan-400 bg-cyan-50' : 'border-gray-200 bg-gray-50'}`}>
                <div className="text-xs font-semibold text-gray-700 mb-1 uppercase">{key.replace('_', ' ')}</div>
                <pre className="text-[10px] text-gray-600 overflow-auto max-h-32 whitespace-pre-wrap font-mono">
                  {JSON.stringify(preset, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        </div>

        {/* Test Data Reference */}
        <div className="bg-cyan-50 rounded-xl border border-cyan-200 p-4">
          <h4 className="text-sm font-semibold text-cyan-800 mb-2">Test GUIDs (from API docs)</h4>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <div><span className="font-medium text-cyan-700">unitId:</span> <span className="font-mono text-cyan-600">7E5A477F-...BD0</span></div>
            <div><span className="font-medium text-cyan-700">locationId:</span> <span className="font-mono text-cyan-600">543F323C-...C7E</span></div>
            <div><span className="font-medium text-cyan-700">scrumSessionId:</span> <span className="font-mono text-cyan-600">338D549F-...C4A</span></div>
            <div><span className="font-medium text-cyan-700">locationName:</span> <span className="font-mono text-cyan-600">Riverside</span></div>
            <div><span className="font-medium text-cyan-700">patientId (Jessica):</span> <span className="font-mono text-cyan-600">17849590-...282</span></div>
            <div><span className="font-medium text-cyan-700">patientId2 (Kenneth):</span> <span className="font-mono text-cyan-600">A4B8A2A3-...96A</span></div>
          </div>
        </div>

        {/* WebSocket Logs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-800">WebSocket Logs</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">{logs.length} messages</span>
              <button
                onClick={() => setLogs([])}
                className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
          <div className="bg-gray-900 rounded-lg p-3 h-[500px] overflow-y-auto font-mono text-xs">
            {logs.length === 0 ? (
              <div className="text-gray-500 text-center py-8">
                Connect and send init to see WebSocket messages here...
              </div>
            ) : (
              logs.map((log, i) => (
                <div key={i} className={`py-0.5 ${logColors[log.type] || 'text-gray-400'}`}>
                  <span className="text-gray-500">[{log.ts}]</span>{' '}
                  <span className={log.type === 'sent' ? 'font-bold' : ''}>{log.message}</span>
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
