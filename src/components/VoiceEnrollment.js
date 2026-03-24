import React, { useState, useRef, useCallback } from 'react';
import { Users, Mic, StopCircle, X, Loader, CheckCircle, XCircle, Play } from 'lucide-react';
import { VOICE_BACKEND } from '../config';

const ENROLLMENT_USERS = [
  { displayName: 'Andrew Park', id: '91393876-7762-4492-a07a-3620b5c7d09f', mail: 'Andrew.Park@lifekindconcepts.com' },
  { displayName: 'Benjamin Lee', id: 'd68fb5fc-bd9b-4e33-8ef5-184ca5f3333b', mail: 'Benjamin.Lee@lifekindconcepts.com' },
  { displayName: 'Beth Johnson', id: '71817244-bc04-462a-9739-a26dea0d6b6c', mail: 'Beth.Johnson@lifekindconcepts.com' },
  { displayName: 'Connie Alarcon', id: 'e7cafc0f-5a53-48d0-8417-cefa892b539d', mail: 'Connie.Alarcon@lifekindconcepts.com' },
  { displayName: 'Felix Lee', id: '9d378f9d-11ad-404a-b877-799ca0ac8ed9', mail: 'Felix.Lee@lifekindconcepts.com' },
  { displayName: 'Jay Marshall', id: '13daf816-e6b9-43fd-aba9-affa034f6ec7', mail: 'Jay.Marshall@lifekindconcepts.com' },
  { displayName: 'Jennifer Chiriano', id: '5bb2d266-76fb-4922-85b7-3066656973d1', mail: 'Jennifer.Chiriano@lifekindconcepts.com' },
  { displayName: 'Justina Guirguis', id: 'a072f860-843b-4f3e-8342-e1defef105f9', mail: 'Justina.Guirguis@lifekindconcepts.com' },
  { displayName: 'Olivia Meza', id: 'e7ef2029-d0d2-4ee4-97f3-cf6eecf9a528', mail: 'Olivia.Meza@lifekindconcepts.com' },
  { displayName: 'Paul Mitchell', id: '1e009eb0-e3bd-4cee-a1be-b8b20a80bda0', mail: 'Paul.Mitchell@lifekindconcepts.com' },
  { displayName: 'UAT-Test-AK', id: 'a63ec38a-18f9-406e-bc3d-6fa45c983e35', mail: 'UAT-Test-AK@lifekindconcepts.com' },
  { displayName: 'UAT-Test001', id: '33adf184-5a9e-404a-8759-7928f7d43963', mail: 'UAT-Test001@lifekindconcepts.com' },
  { displayName: 'Yu Ping Garthwaite', id: '105f18a4-35a7-41f1-88ab-45505a670141', mail: 'Yu.Ping.Garthwaite@lifekindconcepts.com' },
  { displayName: 'Zoey Megard', id: 'bb8f2fff-a303-429d-abad-fee378c66adc', mail: 'Zoey.Megard@lifekindconcepts.com' },
];

const wsConfig = {
  backendWs: VOICE_BACKEND.replace('https://', 'wss://'),
};

export default function VoiceEnrollment({ token }) {
  const [selectedUser, setSelectedUser] = useState(null);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [messages, setMessages] = useState([]);
  const [logs, setLogs] = useState([]);

  const wsRef = useRef(null);
  const audioCtxRef = useRef(null);
  const processorRef = useRef(null);
  const streamRef = useRef(null);
  const logsEndRef = useRef(null);

  const addLog = useCallback((msg, type = 'info') => {
    setLogs(prev => [...prev, { msg, type, time: new Date().toLocaleTimeString() }]);
    // Auto-scroll to bottom
    setTimeout(() => logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioCtx({ sampleRate: 16000 });
      audioCtxRef.current = audioCtx;

      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }

      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        const input = e.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) {
          let s = Math.max(-1, Math.min(1, input[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        wsRef.current.send(pcm16.buffer);
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);

      setIsRecording(true);
      setLogs(prev => [...prev, { msg: 'Recording PCM audio for enrollment...', type: 'success', time: new Date().toLocaleTimeString() }]);
    } catch (err) {
      setLogs(prev => [...prev, { msg: `Mic error: ${err.message}`, type: 'error', time: new Date().toLocaleTimeString() }]);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setIsRecording(false);
  }, []);

  // Just open the dialog — don't connect or record yet
  const selectUser = (user) => {
    setSelectedUser(user);
    setMessages([]);
    setLogs([]);
    setIsEnrolling(false);
    setIsRecording(false);
  };

  // Connect WS + start recording when user clicks "Start Enrollment"
  const startEnrollment = useCallback(async () => {
    if (!selectedUser) return;
    const user = selectedUser;

    setMessages([]);
    setLogs([]);
    setIsEnrolling(true);

    if (wsRef.current) wsRef.current.close();

    const wsUrl = token
      ? `${wsConfig.backendWs}/enroll?token=${token}`
      : `${wsConfig.backendWs}/enroll`;

    // Use functional setState so logs don't get lost
    setLogs([{ msg: `Connecting for ${user.displayName}...`, type: 'info', time: new Date().toLocaleTimeString() }]);

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setLogs(prev => [...prev, { msg: 'Connected to /enroll', type: 'success', time: new Date().toLocaleTimeString() }]);
      ws.send(JSON.stringify({ type: 'start', userNum: user.id }));
      setLogs(prev => [...prev, { msg: `Sent enrollment start (userNum=${user.id})`, type: 'info', time: new Date().toLocaleTimeString() }]);
      startRecording();
    };

    ws.onmessage = (event) => {
      const now = new Date().toLocaleTimeString();
      try {
        const message = JSON.parse(event.data);
        setMessages(prev => [...prev, message]);

        if (message.type === 'enrollment_complete' || message.type === 'success') {
          setLogs(prev => [...prev, { msg: 'Enrollment complete!', type: 'success', time: now }]);
        } else if (message.type === 'error') {
          setLogs(prev => [...prev, { msg: `Error: ${message.message || JSON.stringify(message)}`, type: 'error', time: now }]);
        } else {
          setLogs(prev => [...prev, { msg: JSON.stringify(message), type: 'ws', time: now }]);
        }
      } catch {
        setLogs(prev => [...prev, { msg: String(event.data).substring(0, 200), type: 'ws', time: now }]);
      }
      setTimeout(() => logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    };

    ws.onerror = () => {
      setLogs(prev => [...prev, { msg: 'WebSocket error', type: 'error', time: new Date().toLocaleTimeString() }]);
    };

    ws.onclose = (e) => {
      setLogs(prev => [...prev, { msg: `WebSocket closed (code: ${e.code})`, type: 'info', time: new Date().toLocaleTimeString() }]);
      setIsEnrolling(false);
      stopRecording();
    };
  }, [token, selectedUser, startRecording]);

  const stopEnrollment = useCallback(() => {
    stopRecording();
    if (wsRef.current) {
      try { wsRef.current.send(JSON.stringify({ type: 'stop' })); } catch {}
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsEnrolling(false);
    addLog('Stopped enrollment', 'info');
  }, [stopRecording, addLog]);

  const closeDialog = () => {
    if (isEnrolling) stopEnrollment();
    setSelectedUser(null);
    setMessages([]);
    setLogs([]);
  };

  // Extract latest progress from messages
  const latestProgress = messages.length > 0
    ? messages[messages.length - 1]
    : null;

  const progressPercent = latestProgress?.remainingEnrollmentsSpeechLength !== undefined
    ? Math.round((1 - latestProgress.remainingEnrollmentsSpeechLength / (latestProgress.totalEnrollmentsSpeechLength || 1)) * 100)
    : latestProgress?.profileEnrollmentStatus === 'Enrolled' ? 100
    : null;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2 mb-1">
          <Users className="w-5 h-5 text-teal-600" />
          Voice Enrollment
        </h2>
        <p className="text-sm text-gray-500">
          Click on a person to open enrollment, then press Start to begin recording.
        </p>
      </div>

      {/* User Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {ENROLLMENT_USERS.map(user => (
          <button
            key={user.id}
            onClick={() => selectUser(user)}
            disabled={!!selectedUser}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-left hover:border-teal-400 hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-semibold text-sm shrink-0">
                {user.displayName.split(' ').map(n => n[0]).join('').substring(0, 2)}
              </div>
              <div className="min-w-0">
                <div className="font-medium text-gray-800 truncate group-hover:text-teal-700 transition-colors">
                  {user.displayName}
                </div>
                <div className="text-xs text-gray-400 truncate">{user.mail}</div>
                <div className="text-xs text-gray-300 font-mono truncate mt-0.5">{user.id.substring(0, 8)}...</div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Enrollment Dialog */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            {/* Header */}
            <div className="bg-teal-600 px-5 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-white text-lg">{selectedUser.displayName}</h3>
                <p className="text-teal-100 text-xs font-mono">{selectedUser.id}</p>
              </div>
              <button onClick={closeDialog} className="text-teal-200 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Progress */}
            <div className="px-5 py-4">
              {isEnrolling && isRecording && (
                <div className="flex items-center gap-2 text-teal-600 mb-3">
                  <Mic className="w-4 h-4 animate-pulse" />
                  <span className="text-sm font-medium">Recording... speak naturally</span>
                </div>
              )}

              {progressPercent !== null && (
                <div className="mb-3">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-600">Enrollment Progress</span>
                    <span className="font-semibold text-teal-700">{progressPercent}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-teal-500 h-3 rounded-full transition-all duration-300"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 mb-4">
                {!isEnrolling && logs.length === 0 && (
                  <button
                    onClick={startEnrollment}
                    className="flex-1 px-4 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <Play className="w-4 h-4" />
                    Start Enrollment
                  </button>
                )}
                {isEnrolling && (
                  <button
                    onClick={stopEnrollment}
                    className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <StopCircle className="w-4 h-4" />
                    Stop Enrollment
                  </button>
                )}
                {!isEnrolling && logs.length > 0 && (
                  <button
                    onClick={startEnrollment}
                    className="flex-1 px-4 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <Mic className="w-4 h-4" />
                    Retry Enrollment
                  </button>
                )}
              </div>

              {/* Messages Log */}
              <div className="bg-gray-50 rounded-lg border border-gray-200 max-h-72 overflow-y-auto">
                <div className="px-3 py-2 border-b border-gray-200 bg-gray-100 sticky top-0">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Response Log</span>
                </div>
                <div className="p-2 space-y-1">
                  {logs.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-3">Press "Start Enrollment" to begin</p>
                  )}
                  {logs.map((log, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <span className="text-gray-300 shrink-0">{log.time}</span>
                      <span className={
                        log.type === 'error' ? 'text-red-600' :
                        log.type === 'success' ? 'text-green-600' :
                        log.type === 'ws' ? 'text-blue-600 font-mono break-all' :
                        'text-gray-600'
                      }>
                        {log.type === 'success' && <CheckCircle className="w-3 h-3 inline mr-1" />}
                        {log.type === 'error' && <XCircle className="w-3 h-3 inline mr-1" />}
                        {log.type === 'ws' && <Loader className="w-3 h-3 inline mr-1" />}
                        {log.msg}
                      </span>
                    </div>
                  ))}
                  <div ref={logsEndRef} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
