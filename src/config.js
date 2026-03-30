/**
 * Configuration for FOCUS UTC Backend Tester
 * Manual OAuth flow (matches main app's Better Auth pattern)
 */

// OAuth configuration — uses the main app's Web-type app registration
export const OAUTH_CONFIG = {
  clientId: '9de823b8-9748-4461-a4ea-b06c6bffd13f',
  tenantId: '45296cf8-0a85-4f08-a78e-624bea2dee95',
  redirectUri: `${window.location.origin}/api/auth/callback/microsoft`,
  authorizeUrl: 'https://login.microsoftonline.com/45296cf8-0a85-4f08-a78e-624bea2dee95/oauth2/v2.0/authorize',
  scope: 'api://7cae726c-e76c-4abb-a584-0c053adad85a/access_as_user openid profile email offline_access',
};

// API endpoints configuration
export const API_BASE = 'https://ai-api-backend-eehacnhvendebpbu.westus2-01.azurewebsites.net';
export const VOICE_BACKEND = 'https://ai-speech-demo-hhhma9dyakhzh0e6.westus2-01.azurewebsites.net';

// Sample test data GUIDs (from tested endpoints)
export const TEST_DATA = {
  locationId: '543F323C-97C9-4419-88D6-0E1E832CDC7E',
  unitId: 'A49AD52B-4E9E-4C4F-912C-3DC0D5ECC60F',
  patientId: '0025B8D7-8257-4967-B9F4-11B5D541D75C',
  patientId2: '4A4F88CC-746A-42B1-A827-00F32F92CB3A',
  actionId: 'E5261ADB-57ED-435A-91BB-6ADFE25ED899',
  slotId: '7EFD6095-7741-413C-9545-BFBAE6E1DF76',
  providerUserId: 'AC26D32E-7C56-4E3E-866D-0086936B1238',
};

// ============================================================
// REAL PATIENTS — loaded from DB via api.sGetPatientsToday
// These are populated at runtime. Use TEST_DATA GUIDs for defaults.
// ============================================================
export const DEFAULT_PATIENTS = [
  { id: TEST_DATA.patientId,  name: 'Patient 1 (from DB)', label: 'Default Patient' },
  { id: TEST_DATA.patientId2, name: 'Patient 2 (from DB)', label: 'Second Patient' },
];

// ============================================================
// SUGGESTED QUESTIONS — each targets a specific SP via function calling
// All connected to real DB data (no synthetic placeholders)
// ============================================================

// Welcome screen — schedule overview, cross-patient queries
export const WELCOME_QUESTIONS = [
  // get_daily_schedule → api.sGetPatientsToday
  { q: "Who's on the schedule today?", fn: 'get_daily_schedule', expect: 'Real patients from api.sGetPatientsToday' },
  { q: "Show me today's patient schedule", fn: 'get_daily_schedule', expect: 'Patient list with appointment times, types, units' },
  // get_patients_by_filter → api.sGetPatientsByFilter(@FilterType)
  { q: "How many new intakes today?", fn: 'get_patients_by_filter(new_intake)', expect: 'Patients with FilterType=new_intake' },
  { q: "Any non-English speaking patients?", fn: 'get_patients_by_filter(language)', expect: 'Patients with FilterType=language' },
  { q: "Which patients are at risk based on PHQ-9?", fn: 'get_patients_by_filter(risk_phq9)', expect: 'Patients with FilterType=risk_phq9' },
  { q: "Show active patients", fn: 'get_patients_by_filter(status, active)', expect: 'Patients with FilterType=status, FilterValue=active' },
  // get_unreviewed_items → api.sGetUnreviewedItems
  { q: "Any unreviewed labs or imaging?", fn: 'get_unreviewed_items(all)', expect: 'Unreviewed labs and imaging from DB' },
  { q: "Show unreviewed imaging only", fn: 'get_unreviewed_items(imaging)', expect: 'Unreviewed imaging results' },
  { q: "Any unreviewed lab results?", fn: 'get_unreviewed_items(labs)', expect: 'Unreviewed lab results' },
  // get_procedures_today → api.sGetProceduresToday
  { q: "What procedures are planned for today?", fn: 'get_procedures_today', expect: 'Confirmed procedures from DB' },
  // search_patient → api.sSearchPatients
  { q: "Find a patient by name (type any name)", fn: 'search_patient', expect: 'Patient search results from api.sSearchPatients' },
];

// Inside scrum — single patient deep dive (uses selected patient from dropdown)
export const INSIDE_SCRUM_QUESTIONS = [
  // get_patient_detail → api.sGetPatientOverview
  { q: "Give me a 30-second synopsis of this patient", fn: 'get_patient_detail', expect: 'Patient overview from api.sGetPatientOverview' },
  { q: "What is the diagnosis?", fn: 'get_patient_detail', expect: 'Diagnosis from patient overview' },
  { q: "What are the current care actions?", fn: 'get_patient_detail', expect: 'Care actions from patient overview' },
  { q: "Global Health Score breakdown", fn: 'get_patient_detail', expect: 'GHS scores (body/mind/motivation/response/interactivity/social/substance)' },
  // get_patient_uds → api.sGetPatientUDS
  { q: "Show UDS results", fn: 'get_patient_uds', expect: 'UDS results from api.sGetPatientUDS' },
  // get_patient_labs → api.sGetPatientLabs
  { q: "Show lab results", fn: 'get_patient_labs', expect: 'Lab results from api.sGetPatientLabs' },
  // get_patient_phq9 → api.sGetPatientPHQ9
  { q: "What is the PHQ-9 score?", fn: 'get_patient_phq9', expect: 'PHQ-9 score from api.sGetPatientPHQ9' },
  // get_patient_reports → api.sGetPatientDocuments
  { q: "Show imaging reports", fn: 'get_patient_reports', expect: 'Reports from api.sGetPatientDocuments' },
  { q: "What does the latest MRI show?", fn: 'get_patient_reports', expect: 'MRI details from api.sGetPatientDocuments' },
  // suggest_care_actions → api.sGetPatientOverview + api.sGetServiceCatalog + AI
  { q: "Suggest care actions for this patient", fn: 'suggest_care_actions', expect: 'AI-generated suggestions from service catalog' },
  // Draft content — no SP (AI-generated, labeled DRAFT)
  { q: "Draft a patient education note about exercises", fn: 'none (DRAFT)', expect: 'AI-generated DRAFT content' },
];

// Outside scrum — single patient context (same as inside scrum, but with voice chat)
// Provider is with a patient outside the scrum meeting (1-on-1 session)
export const OUTSIDE_SCRUM_QUESTIONS = [
  // get_patient_detail → api.sGetPatientOverview
  { q: "Give me a synopsis of this patient", fn: 'get_patient_detail', expect: 'Patient overview from api.sGetPatientOverview' },
  { q: "What is the diagnosis?", fn: 'get_patient_detail', expect: 'Diagnosis from patient overview' },
  { q: "What are the current care actions?", fn: 'get_patient_detail', expect: 'Care actions from patient overview' },
  { q: "Global Health Score breakdown", fn: 'get_patient_detail', expect: 'GHS scores from patient overview' },
  // get_patient_uds → api.sGetPatientUDS
  { q: "Show UDS results", fn: 'get_patient_uds', expect: 'UDS from api.sGetPatientUDS' },
  // get_patient_labs → api.sGetPatientLabs
  { q: "Show lab results", fn: 'get_patient_labs', expect: 'Labs from api.sGetPatientLabs' },
  // get_patient_phq9 → api.sGetPatientPHQ9
  { q: "What is the PHQ-9 score?", fn: 'get_patient_phq9', expect: 'PHQ-9 from api.sGetPatientPHQ9' },
  // get_patient_reports → api.sGetPatientDocuments
  { q: "Show imaging reports", fn: 'get_patient_reports', expect: 'Reports from api.sGetPatientDocuments' },
  { q: "What does the latest MRI show?", fn: 'get_patient_reports', expect: 'MRI from api.sGetPatientDocuments' },
  // suggest_care_actions → AI + service catalog
  { q: "Suggest care actions for this patient", fn: 'suggest_care_actions', expect: 'AI suggestions from service catalog' },
  // Draft content — no SP
  { q: "Draft a patient education note about exercises", fn: 'none (DRAFT)', expect: 'AI-generated DRAFT content' },
];

// All API endpoints (real DB-connected SPs)
export const ENDPOINTS = [
  {
    id: 1,
    method: 'GET',
    name: 'Get Provider Profile',
    path: '/api/providers/me',
    description: 'Returns the logged-in provider profile. No params needed - uses JWT.',
    url: () => `${API_BASE}/api/providers/me`,
  },
  {
    id: 2,
    method: 'GET',
    name: 'Get Units for Today',
    path: '/api/units?locationId=<GUID>',
    description: 'Get all units scheduled for today at a given location.',
    url: () => `${API_BASE}/api/units?locationId=${TEST_DATA.locationId}`,
  },
  {
    id: 3,
    method: 'GET',
    name: 'Get Patient Queue',
    path: '/api/units/:unitId/patients',
    description: 'Get the patient queue for a specific unit.',
    url: () => `${API_BASE}/api/units/${TEST_DATA.unitId}/patients`,
  },
  {
    id: 4,
    method: 'POST',
    name: 'Initiate Scrum',
    path: '/api/units/:unitId/scrum/initiate',
    description: 'Initiate a scrum session for a unit.',
    url: () => `${API_BASE}/api/units/${TEST_DATA.unitId}/scrum/initiate`,
  },
  {
    id: 5,
    method: 'POST',
    name: 'Start Scrum',
    path: '/api/units/:unitId/scrum/start',
    description: 'Start the scrum session (transition to in_progress).',
    url: () => `${API_BASE}/api/units/${TEST_DATA.unitId}/scrum/start`,
  },
  {
    id: 6,
    method: 'PUT',
    name: 'Complete Patient Scrum',
    path: '/api/units/:unitId/patients/:patientId/complete',
    description: 'Mark a patient scrum discussion as complete.',
    url: () => `${API_BASE}/api/units/${TEST_DATA.unitId}/patients/${TEST_DATA.patientId2}/complete`,
  },
  {
    id: 7,
    method: 'GET',
    name: 'Get Patients Paged',
    path: '/api/patients?page=1&limit=20',
    description: 'Get a paginated list of all patients.',
    url: () => `${API_BASE}/api/patients?page=1&limit=20`,
  },
  {
    id: 8,
    method: 'GET',
    name: 'Search Patients',
    path: '/api/patients/search?q=<term>',
    description: 'Search patients by name.',
    url: () => `${API_BASE}/api/patients/search?q=John`,
  },
  {
    id: 9,
    method: 'GET',
    name: 'Search Care Actions',
    path: '/api/care-actions/search?q=<term>&topN=10',
    description: 'Search CPT codes / service catalog.',
    url: () => `${API_BASE}/api/care-actions/search?q=yoga&topN=10`,
  },
  {
    id: 10,
    method: 'POST',
    name: 'Create Care Action',
    path: '/api/units/:unitId/patients/:patientId/care-actions',
    description: 'Add a new care action to a patient during scrum.',
    url: () => `${API_BASE}/api/units/${TEST_DATA.unitId}/patients/${TEST_DATA.patientId}/care-actions`,
    body: { serviceCode: '99215', serviceName: 'Medication Management', disciplineCode: 'behavioral' },
  },
  {
    id: 11,
    method: 'PUT',
    name: 'Update Care Action',
    path: '/api/units/:unitId/patients/:patientId/care-actions/:actionId',
    description: 'Update an existing care action. Use actionId from create (#10).',
    url: () => `${API_BASE}/api/units/${TEST_DATA.unitId}/patients/${TEST_DATA.patientId}/care-actions/${TEST_DATA.actionId}`,
    body: { serviceCode: '97110', serviceName: 'Therapeutic Exercise', disciplineCode: 'physical_therapy' },
  },
  {
    id: 12,
    method: 'DELETE',
    name: 'Delete Care Action',
    path: '/api/units/:unitId/patients/:patientId/care-actions/:actionId',
    description: 'Delete a care action from a patient.',
    url: () => `${API_BASE}/api/units/${TEST_DATA.unitId}/patients/${TEST_DATA.patientId}/care-actions/${TEST_DATA.actionId}`,
  },
  {
    id: 13,
    method: 'PUT',
    name: 'Approve Care Action',
    path: '/api/units/:unitId/patients/:patientId/care-actions/:actionId/approve',
    description: 'Approve a care action. Approver from JWT.',
    url: () => `${API_BASE}/api/units/${TEST_DATA.unitId}/patients/${TEST_DATA.patientId}/care-actions/${TEST_DATA.actionId}/approve`,
  },
  {
    id: 14,
    method: 'PATCH',
    name: 'Mark Attendance',
    path: '/api/units/:unitId/patients/:patientId/care-actions/:actionId/attendance',
    description: 'Mark patient attendance for a care action (present/absent).',
    url: () => `${API_BASE}/api/units/${TEST_DATA.unitId}/patients/${TEST_DATA.patientId}/care-actions/${TEST_DATA.actionId}/attendance`,
    body: { attendance: 'present' },
  },
  {
    id: 15,
    method: 'PATCH',
    name: 'Record Outcome',
    path: '/api/units/:unitId/patients/:patientId/care-actions/:actionId/outcome',
    description: 'Record the outcome of a care action after session.',
    url: () => `${API_BASE}/api/units/${TEST_DATA.unitId}/patients/${TEST_DATA.patientId}/care-actions/${TEST_DATA.actionId}/outcome`,
    body: { outcome: 'completed', outcomeNotes: 'Patient tolerated treatment well. Range of motion improved.' },
  },
  {
    id: 16,
    method: 'POST',
    name: 'Create Flow Plan',
    path: '/api/units/:unitId/flow-plan',
    description: 'Create the flow coordination plan for a unit after scrum.',
    url: () => `${API_BASE}/api/units/${TEST_DATA.unitId}/flow-plan`,
  },
  {
    id: 17,
    method: 'GET',
    name: 'Get Flow Schedule',
    path: '/api/units/:unitId/flow-schedule',
    description: 'Get the flow schedule for a unit.',
    url: () => `${API_BASE}/api/units/${TEST_DATA.unitId}/flow-schedule`,
  },
  {
    id: 18,
    method: 'PATCH',
    name: 'Assign Slot Provider',
    path: '/api/units/:unitId/flow-schedule/slots/:slotId/provider',
    description: 'Assign a provider to a flow slot.',
    url: () => `${API_BASE}/api/units/${TEST_DATA.unitId}/flow-schedule/slots/${TEST_DATA.slotId}/provider`,
    body: { disciplineCode: 'medical', providerUserId: TEST_DATA.providerUserId },
  },
  {
    id: 19,
    method: 'PATCH',
    name: 'Assign Slot Patient',
    path: '/api/units/:unitId/flow-schedule/slots/:slotId/patient',
    description: 'Assign a patient to a flow slot.',
    url: () => `${API_BASE}/api/units/${TEST_DATA.unitId}/flow-schedule/slots/${TEST_DATA.slotId}/patient`,
    body: { patientId: '3C707AC9-85AA-4778-849E-385100E323B9' },
  },
  {
    id: 20,
    method: 'POST',
    name: 'AI Chat',
    path: '/api/chat',
    description: 'Send a message to FOCUS AI chatbot. Uses function calling with real DB data.',
    url: () => `${API_BASE}/api/chat`,
    body: { message: "Who's on the schedule today?", conversationHistory: [], locationId: TEST_DATA.locationId },
  },
  {
    id: 21,
    method: 'POST',
    name: 'AI Batch Test (Single Patient)',
    path: '/api/admin/ai-batch/test',
    description: 'Generate AI scrum content for a single patient.',
    url: () => `${API_BASE}/api/admin/ai-batch/test`,
    body: { patientId: TEST_DATA.patientId },
  },
  {
    id: 22,
    method: 'POST',
    name: 'AI Batch Test (All Patients)',
    path: '/api/admin/ai-batch/test-all',
    description: 'Generate AI scrum content for all patients at location.',
    url: () => `${API_BASE}/api/admin/ai-batch/test-all`,
  },
  // ── New endpoints (not previously tested) ──────────────────
  {
    id: 23,
    method: 'GET',
    name: 'Get Scrum Agenda',
    path: '/api/units/:unitId/scrum/agenda',
    description: 'Get scrum agenda for pre-scrum screen. SP: api.sGetScrumAgenda.',
    url: () => `${API_BASE}/api/units/${TEST_DATA.unitId}/scrum/agenda`,
  },
  {
    id: 24,
    method: 'GET',
    name: 'Get Scrum Session Status',
    path: '/api/units/scrum/sessions/:scrumSessionId',
    description: 'Get scrum session status. Need a real scrumSessionId from initiate scrum (#4).',
    url: () => `${API_BASE}/api/units/scrum/sessions/REPLACE_WITH_SCRUM_SESSION_ID`,
  },
  {
    id: 25,
    method: 'GET',
    name: 'Get Scrum Attendance',
    path: '/api/units/:unitId/scrum/:scrumSessionId/attendance',
    description: 'Get attendance list for a scrum session. SP: api.sGetScrumAttendance.',
    url: () => `${API_BASE}/api/units/${TEST_DATA.unitId}/scrum/REPLACE_WITH_SCRUM_SESSION_ID/attendance`,
  },
  {
    id: 26,
    method: 'GET',
    name: 'Get Current Scrum Patient',
    path: '/api/units/:unitId/scrum/:scrumSessionId/current-patient',
    description: 'Get next undiscussed patient with full overview. SP: api.sGetCurrentScrumPatient.',
    url: () => `${API_BASE}/api/units/${TEST_DATA.unitId}/scrum/REPLACE_WITH_SCRUM_SESSION_ID/current-patient`,
  },
  {
    id: 27,
    method: 'PUT',
    name: 'Complete Scrum Session',
    path: '/api/units/:unitId/scrum/:scrumSessionId/complete',
    description: 'Complete an entire scrum session. SP: api.sCompleteScrumSession. Idempotent.',
    url: () => `${API_BASE}/api/units/${TEST_DATA.unitId}/scrum/REPLACE_WITH_SCRUM_SESSION_ID/complete`,
  },
  {
    id: 28,
    method: 'GET',
    name: 'Get Patient Overview',
    path: '/api/units/:unitId/patients/:patientId/overview',
    description: 'Get full patient overview for scrum. SP: api.sGetPatientOverview.',
    url: () => `${API_BASE}/api/units/${TEST_DATA.unitId}/patients/${TEST_DATA.patientId}/overview`,
  },
  {
    id: 29,
    method: 'PATCH',
    name: 'Patch GHS Scores',
    path: '/api/units/:unitId/patients/:patientId/ghs',
    description: 'Batch update patient GHS scores. SP: api.sPatchPatientGhsBatch.',
    url: () => `${API_BASE}/api/units/${TEST_DATA.unitId}/patients/${TEST_DATA.patientId}/ghs`,
    body: { scrumSessionId: 'REPLACE_WITH_SCRUM_SESSION_ID', updates: [{ domain: 'body', score: 2 }] },
  },
  {
    id: 30,
    method: 'GET',
    name: 'Get Patients Today',
    path: '/api/units/today?date=YYYY-MM-DD',
    description: 'Get patients/units for today. SP: api.sGetPatientsToday.',
    url: () => `${API_BASE}/api/units/today?date=${new Date().toISOString().split('T')[0]}&locationId=${TEST_DATA.locationId}`,
  },
  {
    id: 31,
    method: 'POST',
    name: 'Reset Scrum UAT',
    path: '/api/units/reset-uat',
    description: 'Reset scrum state for UAT testing. SP: api.sResetScrumUAT.',
    url: () => `${API_BASE}/api/units/reset-uat`,
    body: { locationId: TEST_DATA.locationId },
  },
  {
    id: 32,
    method: 'POST',
    name: 'Get WS Ticket',
    path: '/api/auth/ws-ticket',
    description: 'Issue single-use ticket for WebSocket auth. Returns opaque ticket (30s TTL).',
    url: () => `${API_BASE}/api/auth/ws-ticket`,
  },
  {
    id: 33,
    method: 'PUT',
    name: 'Approve Care Actions (Bulk)',
    path: '/api/units/:unitId/patients/:patientId/care-actions/approve',
    description: 'Bulk approve care actions. SP: api.sApprovePatientCareAction.',
    url: () => `${API_BASE}/api/units/${TEST_DATA.unitId}/patients/${TEST_DATA.patientId}/care-actions/approve`,
    body: { scrumSessionId: 'REPLACE_WITH_SCRUM_SESSION_ID', actions: [{ actionId: TEST_DATA.actionId, providerUserId: TEST_DATA.providerUserId, roleId: 'medical' }] },
  },
];

// Chat endpoint
export const CHAT_ENDPOINT = `${API_BASE}/api/chat`;
