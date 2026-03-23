import React, { useState, useRef, useCallback } from 'react';
import { Users, Mic, StopCircle, X, Loader, CheckCircle, XCircle } from 'lucide-react';
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

  const addLog = useCallback((msg, type = 'info') => {
    setLogs(prev => [...prev, { msg, type, time: new Date().toLocaleTimeString() }]);
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { sampleRate: 16000, channelCount: 1 } });
      streamRef.current = stream;

      const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      audioCtxRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      source.connect(processor);
      processor.connect(audioCtx.destination);

      processor.onaudioprocess = (e) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        const float32 = e.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(float32.length);
        for (let i = 0; i < float32.length; i++) {
          const s = Math.max(-1, Math.min(1, float32[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        wsRef.current.send(pcm16.buffer);
      };

      setIsRecording(true);
      addLog('Recording audio...', 'success');
    } catch (err) {
      addLog(`Mic error: ${err.message}`, 'error');
    }
  }, [addLog]);

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

  const startEnrollment = useCallback(async (user) => {
    setSelectedUser(user);
    setMessages([]);
    setLogs([]);
    setIsEnrolling(true);

    if (wsRef.current) wsRef.current.close();

    const wsUrl = token
      ? `${wsConfig.backendWs}/enroll?token=${token}`
      : `${wsConfig.backendWs}/enroll`;

    addLog(`Connecting for ${user.displayName}...`, 'info');
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      addLog('Connected to /enroll', 'success');
      ws.send(JSON.stringify({ type: 'start', personId: user.id }));
      addLog(`Sent enrollment start (personId=${user.id})`, 'info');
      startRecording();
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        setMessages(prev => [...prev, message]);

        if (message.type === 'enrollment_complete' || message.type === 'success') {
          addLog('Enrollment complete!', 'success');
          stopEnrollment();
        } else if (message.type === 'error') {
          addLog(`Error: ${message.message}`, 'error');
        } else {
          addLog(`${JSON.stringify(message)}`, 'ws');
        }
      } catch {
        addLog(`${event.data}`, 'ws');
      }
    };

    ws.onerror = () => {
      addLog('WebSocket error', 'error');
      stopEnrollment();
    };

    ws.onclose = () => {
      addLog('WebSocket closed', 'info');
      setIsEnrolling(false);
    };
  }, [token, addLog, startRecording]);

  const stopEnrollment = useCallback(() => {
    stopRecording();
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ type: 'stop' }));
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsEnrolling(false);
  }, [stopRecording]);

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
          Click on a person to start voice profile enrollment. Speak for ~20 seconds to complete enrollment.
        </p>
      </div>

      {/* User Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {ENROLLMENT_USERS.map(user => (
          <button
            key={user.id}
            onClick={() => startEnrollment(user)}
            disabled={isEnrolling}
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

              {/* Action Button */}
              <div className="flex gap-2 mb-4">
                {isEnrolling ? (
                  <button
                    onClick={stopEnrollment}
                    className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <StopCircle className="w-4 h-4" />
                    Stop Enrollment
                  </button>
                ) : (
                  <button
                    onClick={() => startEnrollment(selectedUser)}
                    className="flex-1 px-4 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <Mic className="w-4 h-4" />
                    Retry Enrollment
                  </button>
                )}
              </div>

              {/* Messages Log */}
              <div className="bg-gray-50 rounded-lg border border-gray-200 max-h-52 overflow-y-auto">
                <div className="px-3 py-2 border-b border-gray-200 bg-gray-100 sticky top-0">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Response Log</span>
                </div>
                <div className="p-2 space-y-1">
                  {logs.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-3">Click a user to begin enrollment</p>
                  )}
                  {logs.map((log, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <span className="text-gray-300 shrink-0">{log.time}</span>
                      <span className={
                        log.type === 'error' ? 'text-red-600' :
                        log.type === 'success' ? 'text-green-600' :
                        log.type === 'ws' ? 'text-blue-600 font-mono' :
                        'text-gray-600'
                      }>
                        {log.type === 'success' && <CheckCircle className="w-3 h-3 inline mr-1" />}
                        {log.type === 'error' && <XCircle className="w-3 h-3 inline mr-1" />}
                        {log.type === 'ws' && <Loader className="w-3 h-3 inline mr-1" />}
                        {log.msg}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
