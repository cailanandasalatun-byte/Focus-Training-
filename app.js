/* =============================================
   PELATIH FOKUS – Focus Trainer
   app.js  |  All logic in one file
   ============================================= */

'use strict';

/* ─────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────── */
const LS_KEY   = 'focus_trainer_v1';
const STROKE   = 2 * Math.PI * 88; // SVG ring circumference

const MODES = {
  pomodoro: { label: 'Pomodoro',         phase: 'Fokus',           seconds: 25 * 60 },
  short:    { label: 'Istirahat Pendek',  phase: 'Istirahat Pendek', seconds: 5  * 60 },
  long:     { label: 'Istirahat Panjang', phase: 'Istirahat Panjang',seconds: 15 * 60 },
};

const DIST_LABELS = {
  sosmed:  '📱 Sosial Media',
  pikiran: '💭 Pikiran Melayang',
  suara:   '🔊 Kebisingan/Suara',
  notif:   '🔔 Notifikasi',
  ngobrol: '🗣 Mengobrol',
  lainnya: '❓ Lainnya',
};

// Stroop-like test data: { word, wordColor, correctAnswer }
const STROOP_WORDS = [
  { word: 'MERAH',   color: '#ff6b6b', name: 'Merah'  },
  { word: 'HIJAU',   color: '#06d6a0', name: 'Hijau'  },
  { word: 'BIRU',    color: '#4dabf7', name: 'Biru'   },
  { word: 'KUNING',  color: '#ffd166', name: 'Kuning' },
  { word: 'UNGU',    color: '#a78bfa', name: 'Ungu'   },
  { word: 'ORANYE',  color: '#ff9f43', name: 'Oranye' },
];

const COLOR_NAMES = ['Merah','Hijau','Biru','Kuning','Ungu','Oranye'];

/* ─────────────────────────────────────────────
   DOM REFERENCES
───────────────────────────────────────────── */
const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

const dom = {
  // Nav
  navBtns:     $$('.nav-btn'),
  screens:     { timer: $('screen-timer'), test: $('screen-test'), analytics: $('screen-analytics') },

  // Timer
  sessionLabel:  $('session-label'),
  sessionBadge:  $('session-badge'),
  sessionCount:  $('session-count'),
  timerDisplay:  $('timer-display'),
  timerPhase:    $('timer-phase'),
  ringProgress:  $('ring-progress'),
  btnStart:      $('btn-start'),
  btnReset:      $('btn-reset'),
  btnSkip:       $('btn-skip'),
  modeTabs:      $$('.mode-tab'),

  // Distractions
  distBtns:     $$('.dist-btn'),
  distCountBadge:$('dist-count-badge'),
  distLog:       $('dist-log'),

  // Mini-test
  testTabs:      $$('.test-tab'),
  testPanels:    { reaction: $('test-reaction'), attention: $('test-attention') },

  // Reaction test
  reactionInstruction: $('reaction-instruction'),
  reactionWaiting:     $('reaction-waiting'),
  reactionGo:          $('reaction-go'),
  reactionResult:      $('reaction-result'),
  goCircle:            $('go-circle'),
  btnStartReaction:    $('btn-start-reaction'),
  reactionMs:          $('reaction-ms'),
  reactionRating:      $('reaction-rating'),
  reactionHistList:    $('reaction-history-list'),
  btnRetryReaction:    $('btn-retry-reaction'),

  // Attention test
  attentionIntro:    $('attention-intro'),
  attentionQuestion: $('attention-question'),
  attentionResult:   $('attention-result'),
  btnStartAttention: $('btn-start-attention'),
  qProgBar:          $('q-prog-bar'),
  qCount:            $('q-count'),
  qWord:             $('q-word'),
  qChoices:          $('q-choices'),
  qFeedback:         $('q-feedback'),
  attScore:          $('att-score'),
  attAvgRt:          $('att-avg-rt'),
  attRating:         $('att-rating'),
  btnRetryAttention: $('btn-retry-attention'),

  // Analytics
  sTotalSessions:    $('s-total-sessions'),
  sAvgDist:          $('s-avg-dist'),
  sBestRt:           $('s-best-rt'),
  sAvgAcc:           $('s-avg-acc'),
  analyticsEmpty:    $('analytics-empty'),
  btnClearData:      $('btn-clear-data'),
  pieLegend:         $('pie-legend'),

  // Modal & Toast
  sessionModal:  $('session-modal'),
  modalIcon:     $('modal-icon'),
  modalTitle:    $('modal-title'),
  modalBody:     $('modal-body'),
  modalStats:    $('modal-stats'),
  modalContinue: $('modal-continue'),
  modalTest:     $('modal-test'),
  toast:         $('toast'),
  toastIcon:     $('toast-icon'),
  toastMsg:      $('toast-msg'),
};

/* ─────────────────────────────────────────────
   STORAGE
───────────────────────────────────────────── */
function loadData() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || defaultData(); }
  catch { return defaultData(); }
}
function saveData(d) { localStorage.setItem(LS_KEY, JSON.stringify(d)); }
function defaultData() {
  return { sessions: [], testResults: [] };
}

let appData = loadData();

/* ─────────────────────────────────────────────
   NAVIGATION
───────────────────────────────────────────── */
function showScreen(name) {
  Object.values(dom.screens).forEach(s => s.classList.remove('active'));
  dom.screens[name].classList.add('active');
  dom.navBtns.forEach(b => {
    b.classList.toggle('active', b.dataset.screen === name);
  });
  if (name === 'analytics') renderAnalytics();
}

dom.navBtns.forEach(btn => {
  btn.addEventListener('click', () => showScreen(btn.dataset.screen));
});

/* ─────────────────────────────────────────────
   POMODORO TIMER
───────────────────────────────────────────── */
const timer = {
  mode:       'pomodoro',
  total:      MODES.pomodoro.seconds,
  remaining:  MODES.pomodoro.seconds,
  running:    false,
  interval:   null,
  pomodoroCount: 0,

  // Session-level distraction tracking
  sessionDistractions: [],
  sessionStart: null,
};

function timerSetMode(mode) {
  if (timer.running) timerStop();
  timer.mode      = mode;
  timer.total     = MODES[mode].seconds;
  timer.remaining = MODES[mode].seconds;

  dom.modeTabs.forEach(t => t.classList.toggle('active', t.dataset.mode === mode));
  dom.timerPhase.textContent = MODES[mode].phase;

  const isBreak = mode !== 'pomodoro';
  dom.ringProgress.classList.toggle('break-mode', isBreak);
  dom.sessionBadge.classList.toggle('break', isBreak);
  dom.sessionBadge.textContent = isBreak ? 'Istirahat' : 'Fokus';

  updateTimerDisplay();
  updateRing(1);
}

function timerStart() {
  if (timer.running) return;
  timer.running = true;
  if (!timer.sessionStart) timer.sessionStart = new Date();
  dom.btnStart.textContent = '⏸ Jeda';
  dom.btnStart.style.background = 'linear-gradient(135deg,#ff9f43,#e67e22)';

  timer.interval = setInterval(() => {
    timer.remaining--;
    updateTimerDisplay();
    updateRing(timer.remaining / timer.total);

    if (timer.remaining <= 0) {
      clearInterval(timer.interval);
      timer.running = false;
      onTimerComplete();
    }
  }, 1000);
}

function timerPause() {
  clearInterval(timer.interval);
  timer.running = false;
  dom.btnStart.textContent = '▶ Lanjut';
  dom.btnStart.style.background = '';
}

function timerStop() {
  clearInterval(timer.interval);
  timer.running = false;
  dom.btnStart.textContent = '▶ Mulai';
  dom.btnStart.style.background = '';
}

function timerReset() {
  timerStop();
  timer.remaining = timer.total;
  timer.sessionStart = null;
  timer.sessionDistractions = [];
  updateTimerDisplay();
  updateRing(1);
  clearDistLog();
}

function timerSkip() {
  timerStop();
  onTimerComplete();
}

function onTimerComplete() {
  // Save session data if it was a pomodoro focus session
  if (timer.mode === 'pomodoro') {
    timer.pomodoroCount++;
    dom.sessionCount.textContent = `Sesi ${timer.pomodoroCount + 1}`;
    saveSessionRecord();
  }

  // Show modal
  const isPomodoro = timer.mode === 'pomodoro';
  dom.modalIcon.textContent  = isPomodoro ? '🎉' : '☕';
  dom.modalTitle.textContent = isPomodoro ? 'Sesi Fokus Selesai!' : 'Istirahat Selesai!';
  dom.modalBody.textContent  = isPomodoro
    ? 'Waktu fokus telah usai. Ambil istirahat sejenak.'
    : 'Istirahat selesai. Siap fokus kembali?';

  // Stats in modal
  const distCount = timer.sessionDistractions.length;
  const focusMin  = Math.floor(MODES[timer.mode].seconds / 60);
  dom.modalStats.innerHTML = `
    <div class="modal-stat-row"><span>Durasi</span><span class="modal-stat-val">${focusMin} menit</span></div>
    <div class="modal-stat-row"><span>Distraksi tercatat</span><span class="modal-stat-val">${distCount} kali</span></div>
  `;

  dom.sessionModal.classList.remove('hidden');

  // Notification sound (Web Audio API beep)
  playBeep(isPomodoro ? 880 : 440, 0.15, 0.6);
}

function saveSessionRecord() {
  const now = new Date();
  const hour = now.getHours();
  const dateStr = now.toISOString().split('T')[0];

  const record = {
    date: dateStr,
    hour: hour,
    distractions: [...timer.sessionDistractions],
    distCount: timer.sessionDistractions.length,
    mode: timer.mode,
    ts: now.toISOString(),
  };

  appData.sessions.push(record);
  saveData(appData);
}

// Timer button events
dom.btnStart.addEventListener('click', () => {
  if (timer.running) timerPause(); else timerStart();
});
dom.btnReset.addEventListener('click', timerReset);
dom.btnSkip.addEventListener('click', timerSkip);

dom.modeTabs.forEach(tab => {
  tab.addEventListener('click', () => timerSetMode(tab.dataset.mode));
});

// Modal actions
dom.modalContinue.addEventListener('click', () => {
  dom.sessionModal.classList.add('hidden');
  timerReset();
  // Auto-switch to next sensible mode
  if (timer.mode === 'pomodoro') {
    timerSetMode(timer.pomodoroCount % 4 === 0 ? 'long' : 'short');
  } else {
    timerSetMode('pomodoro');
  }
});

dom.modalTest.addEventListener('click', () => {
  dom.sessionModal.classList.add('hidden');
  timerReset();
  showScreen('test');
});

/* ─────────────────────────────────────────────
   TIMER DISPLAY HELPERS
───────────────────────────────────────────── */
function updateTimerDisplay() {
  const m = String(Math.floor(timer.remaining / 60)).padStart(2, '0');
  const s = String(timer.remaining % 60).padStart(2, '0');
  dom.timerDisplay.textContent = `${m}:${s}`;
}

function updateRing(fraction) {
  // fraction: 1 = full, 0 = empty
  const offset = STROKE * (1 - fraction);
  dom.ringProgress.style.strokeDashoffset = offset;
}

/* ─────────────────────────────────────────────
   DISTRACTION TRACKER
───────────────────────────────────────────── */
dom.distBtns.forEach(btn => {
  btn.addEventListener('click', () => recordDistraction(btn.dataset.type));
});

function recordDistraction(type) {
  const now = new Date();
  const entry = {
    type,
    label: DIST_LABELS[type] || type,
    time: now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    ts: now.toISOString(),
  };
  timer.sessionDistractions.push(entry);
  appendDistLogItem(entry);
  updateDistBadge();
  showToast('🔔', `Dicatat: ${entry.label}`);
}

function appendDistLogItem(entry) {
  // Remove empty placeholder
  const empty = dom.distLog.querySelector('.dist-log-empty');
  if (empty) empty.remove();

  const item = document.createElement('div');
  item.className = 'dist-log-item';
  item.innerHTML = `
    <span class="dist-log-type">${entry.label}</span>
    <span class="dist-log-time">${entry.time}</span>
  `;
  dom.distLog.prepend(item); // newest first
}

function updateDistBadge() {
  const n = timer.sessionDistractions.length;
  dom.distCountBadge.textContent = `${n} kali`;
}

function clearDistLog() {
  dom.distLog.innerHTML = '<p class="dist-log-empty">Belum ada gangguan dicatat sesi ini.</p>';
  dom.distCountBadge.textContent = '0 kali';
}

/* ─────────────────────────────────────────────
   MINI-TEST – TAB SWITCHING
───────────────────────────────────────────── */
dom.testTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    dom.testTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    Object.entries(dom.testPanels).forEach(([key, panel]) => {
      panel.classList.toggle('active', key === tab.dataset.test);
    });
  });
});

/* ─────────────────────────────────────────────
   REACTION TIME TEST
───────────────────────────────────────────── */
const reaction = {
  state: 'idle', // idle | waiting | go | result
  startTime: null,
  timeoutId: null,
  sessionResults: [], // ms values this page load
};

function reactionShowState(state) {
  dom.reactionInstruction.classList.toggle('hidden', state !== 'idle');
  dom.reactionWaiting.classList.toggle('hidden',     state !== 'waiting');
  dom.reactionGo.classList.toggle('hidden',          state !== 'go');
  dom.reactionResult.classList.toggle('hidden',      state !== 'result');
}

function startReactionTest() {
  reaction.state = 'waiting';
  reactionShowState('waiting');

  // Random delay 1.5s – 5s (prevents anticipation)
  const delay = 1500 + Math.random() * 3500;
  reaction.timeoutId = setTimeout(() => {
    reaction.state = 'go';
    reaction.startTime = performance.now();
    reactionShowState('go');
    dom.goCircle.focus();
  }, delay);
}

function registerReactionClick() {
  if (reaction.state === 'waiting') {
    // Clicked too early
    clearTimeout(reaction.timeoutId);
    reaction.state = 'idle';
    reactionShowState('idle');
    showToast('⚠️', 'Terlalu cepat! Tunggu lingkaran hijau.');
    return;
  }
  if (reaction.state !== 'go') return;

  const ms = Math.round(performance.now() - reaction.startTime);
  reaction.state = 'result';
  reaction.sessionResults.push(ms);

  dom.reactionMs.textContent = `${ms} ms`;
  dom.reactionRating.className = 'result-rating';

  let ratingText, ratingClass;
  if      (ms < 200) { ratingText = '🚀 Luar Biasa Cepat!';  ratingClass = 'rating-great'; }
  else if (ms < 300) { ratingText = '✅ Bagus!';              ratingClass = 'rating-good';  }
  else if (ms < 450) { ratingText = '👍 Cukup Baik';          ratingClass = 'rating-ok';    }
  else               { ratingText = '🐢 Lambat – Perlu Fokus'; ratingClass = 'rating-slow'; }

  dom.reactionRating.textContent = ratingText;
  dom.reactionRating.classList.add(ratingClass);

  // History chips
  renderReactionHistory(ms);

  // Save result
  saveTestResult('reaction', { ms, date: new Date().toISOString() });

  reactionShowState('result');
}

function renderReactionHistory(latestMs) {
  const best = Math.min(...reaction.sessionResults);
  dom.reactionHistList.innerHTML = reaction.sessionResults.map((v, i) => {
    const isBest = v === best && reaction.sessionResults.filter(x => x === best).length === 1
                   || (v === best && i === reaction.sessionResults.indexOf(best));
    return `<span class="history-chip ${isBest ? 'best' : ''}">${v} ms${isBest ? ' 🏆' : ''}</span>`;
  }).join('');
}

dom.btnStartReaction.addEventListener('click', startReactionTest);
dom.goCircle.addEventListener('click', registerReactionClick);
dom.goCircle.addEventListener('keydown', e => { if (e.code === 'Space' || e.code === 'Enter') registerReactionClick(); });
dom.btnRetryReaction.addEventListener('click', () => {
  reaction.state = 'idle';
  reactionShowState('idle');
});

/* ─────────────────────────────────────────────
   SELECTIVE ATTENTION TEST (Stroop-like)
───────────────────────────────────────────── */
const attTest = {
  questions: [],
  current:   0,
  correct:   0,
  rtList:    [],
  qStart:    null,
};

function buildStroopQuestions(n = 10) {
  const qs = [];
  for (let i = 0; i < n; i++) {
    // Pick a word and a different display color
    const wordObj  = STROOP_WORDS[Math.floor(Math.random() * STROOP_WORDS.length)];
    // Display color: different from the word's own name to create conflict
    let displayObj;
    do { displayObj = STROOP_WORDS[Math.floor(Math.random() * STROOP_WORDS.length)]; }
    while (displayObj.name === wordObj.name);

    // Choices: correct answer + 3 distractors
    const correctColor = displayObj.name;
    const wrongChoices = COLOR_NAMES.filter(c => c !== correctColor);
    shuffle(wrongChoices);
    const choices = [correctColor, ...wrongChoices.slice(0, 3)];
    shuffle(choices);

    qs.push({ word: wordObj.word, displayColor: displayObj.color, correctColor, choices });
  }
  return qs;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function startAttentionTest() {
  attTest.questions = buildStroopQuestions(10);
  attTest.current   = 0;
  attTest.correct   = 0;
  attTest.rtList    = [];

  dom.attentionIntro.classList.add('hidden');
  dom.attentionQuestion.classList.remove('hidden');
  dom.attentionResult.classList.add('hidden');
  showQuestion();
}

function showQuestion() {
  const q = attTest.questions[attTest.current];
  const total = attTest.questions.length;

  dom.qProgBar.style.width = `${(attTest.current / total) * 100}%`;
  dom.qCount.textContent   = `${attTest.current + 1} / ${total}`;
  dom.qWord.textContent    = q.word;
  dom.qWord.style.color    = q.displayColor;
  dom.qFeedback.textContent = '';
  dom.qFeedback.className  = 'q-feedback';

  // Build choice buttons
  dom.qChoices.innerHTML = '';
  q.choices.forEach(choice => {
    const btn = document.createElement('button');
    btn.className = 'q-choice-btn';
    btn.textContent = choice;
    btn.addEventListener('click', () => handleAttentionAnswer(choice, btn, q));
    dom.qChoices.appendChild(btn);
  });

  attTest.qStart = performance.now();
}

function handleAttentionAnswer(choice, btn, q) {
  const rt = Math.round(performance.now() - attTest.qStart);
  attTest.rtList.push(rt);

  // Disable all buttons
  dom.qChoices.querySelectorAll('.q-choice-btn').forEach(b => {
    b.disabled = true;
    if (b.textContent === q.correctColor) b.classList.add('correct');
  });

  const isCorrect = choice === q.correctColor;
  if (isCorrect) {
    attTest.correct++;
    btn.classList.add('correct');
    dom.qFeedback.textContent = `✅ Benar! (${rt} ms)`;
    dom.qFeedback.className   = 'q-feedback correct';
  } else {
    btn.classList.add('wrong');
    dom.qFeedback.textContent = `❌ Salah (${rt} ms)`;
    dom.qFeedback.className   = 'q-feedback wrong';
  }

  attTest.current++;

  setTimeout(() => {
    if (attTest.current < attTest.questions.length) {
      showQuestion();
    } else {
      finishAttentionTest();
    }
  }, 900);
}

function finishAttentionTest() {
  const total    = attTest.questions.length;
  const correct  = attTest.correct;
  const avgRt    = Math.round(attTest.rtList.reduce((a, b) => a + b, 0) / attTest.rtList.length);
  const accuracy = Math.round((correct / total) * 100);

  dom.attentionQuestion.classList.add('hidden');
  dom.attentionResult.classList.remove('hidden');

  dom.attScore.textContent  = `${correct} / ${total}`;
  dom.attAvgRt.textContent  = `Rata-rata RT: ${avgRt} ms`;

  let ratingText, ratingClass;
  if      (accuracy >= 90) { ratingText = '🌟 Atensi Sangat Baik!';  ratingClass = 'rating-great'; }
  else if (accuracy >= 70) { ratingText = '✅ Atensi Baik';           ratingClass = 'rating-good';  }
  else if (accuracy >= 50) { ratingText = '👍 Perlu Latihan';         ratingClass = 'rating-ok';    }
  else                     { ratingText = '🔴 Atensi Perlu Ditingkatkan'; ratingClass = 'rating-slow'; }

  dom.attRating.textContent  = ratingText;
  dom.attRating.className    = `result-rating ${ratingClass}`;

  // Save
  saveTestResult('attention', { accuracy, avgRt, correct, total, date: new Date().toISOString() });
  showToast('✅', `Tes selesai: ${correct}/${total} benar (${avgRt} ms)`);
}

dom.btnStartAttention.addEventListener('click', startAttentionTest);
dom.btnRetryAttention.addEventListener('click', () => {
  dom.attentionResult.classList.add('hidden');
  dom.attentionIntro.classList.remove('hidden');
});

/* ─────────────────────────────────────────────
   SAVE TEST RESULT
───────────────────────────────────────────── */
function saveTestResult(type, data) {
  appData.testResults.push({ type, ...data });
  saveData(appData);
}

/* ─────────────────────────────────────────────
   ANALYTICS
───────────────────────────────────────────── */
let charts = {}; // holds Chart.js instances

function renderAnalytics() {
  const sessions    = appData.sessions;
  const testResults = appData.testResults;
  const hasData     = sessions.length > 0 || testResults.length > 0;

  dom.analyticsEmpty.classList.toggle('hidden', hasData);

  // Summary cards
  const pomodoros   = sessions.filter(s => s.mode === 'pomodoro');
  const totalDist   = pomodoros.reduce((a, s) => a + s.distCount, 0);
  const avgDist     = pomodoros.length ? (totalDist / pomodoros.length).toFixed(1) : 0;

  const reactionRes = testResults.filter(r => r.type === 'reaction');
  const attRes      = testResults.filter(r => r.type === 'attention');

  const bestRt = reactionRes.length ? Math.min(...reactionRes.map(r => r.ms)) : null;
  const avgAcc = attRes.length
    ? Math.round(attRes.reduce((a, r) => a + r.accuracy, 0) / attRes.length)
    : null;

  dom.sTotalSessions.textContent = pomodoros.length;
  dom.sAvgDist.textContent       = avgDist;
  dom.sBestRt.textContent        = bestRt !== null ? `${bestRt} ms` : '— ms';
  dom.sAvgAcc.textContent        = avgAcc !== null ? `${avgAcc}%`   : '—%';

  if (!hasData) return;

  renderRtAccChart(testResults);
  renderDistSessionChart(pomodoros);
  renderDistTypeChart(sessions);
  renderProductiveHoursChart(sessions);
}

/* Chart 1: RT & Accuracy per day */
function renderRtAccChart(testResults) {
  const ctx = $('chart-rt-acc').getContext('2d');
  if (charts.rtAcc) charts.rtAcc.destroy();

  // Group by date
  const byDate = {};
  testResults.forEach(r => {
    const d = r.date ? r.date.split('T')[0] : 'Unknown';
    if (!byDate[d]) byDate[d] = { rts: [], accs: [] };
    if (r.type === 'reaction') byDate[d].rts.push(r.ms);
    if (r.type === 'attention') byDate[d].accs.push(r.accuracy);
  });

  const labels  = Object.keys(byDate).sort();
  const rtData  = labels.map(d => byDate[d].rts.length ? Math.round(avg(byDate[d].rts)) : null);
  const accData = labels.map(d => byDate[d].accs.length ? Math.round(avg(byDate[d].accs)) : null);

  charts.rtAcc = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'RT Rata-rata (ms)',
          data: rtData,
          borderColor: '#7c6aff',
          backgroundColor: 'rgba(124,106,255,.15)',
          fill: true,
          tension: .4,
          pointRadius: 5,
          pointBackgroundColor: '#7c6aff',
          yAxisID: 'yRT',
        },
        {
          label: 'Akurasi (%)',
          data: accData,
          borderColor: '#06d6a0',
          backgroundColor: 'rgba(6,214,160,.10)',
          fill: true,
          tension: .4,
          pointRadius: 5,
          pointBackgroundColor: '#06d6a0',
          yAxisID: 'yAcc',
        },
      ],
    },
    options: chartDefaults({
      scales: {
        yRT:  { type:'linear', position:'left',  title:{ display:true, text:'RT (ms)', color:'#8884aa' }, ticks:{ color:'#8884aa' }, grid:{ color:'rgba(255,255,255,.05)' } },
        yAcc: { type:'linear', position:'right', title:{ display:true, text:'Akurasi (%)', color:'#8884aa' }, ticks:{ color:'#8884aa' }, grid:{ drawOnChartArea:false }, min:0, max:100 },
        x:    { ticks:{ color:'#8884aa' }, grid:{ color:'rgba(255,255,255,.05)' } },
      },
    }),
  });
}

/* Chart 2: Distractions per session */
function renderDistSessionChart(sessions) {
  const ctx = $('chart-dist-session').getContext('2d');
  if (charts.distSession) charts.distSession.destroy();

  if (!sessions.length) return;

  const last20 = sessions.slice(-20);
  const labels = last20.map((s, i) => `S${i + 1} (${s.date ? s.date.slice(5) : ''})`);
  const data   = last20.map(s => s.distCount);

  // Color bars: low = green, medium = yellow, high = red
  const colors = data.map(v =>
    v === 0 ? '#06d6a0' : v <= 3 ? '#ffd166' : '#ff6b6b'
  );

  charts.distSession = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Jumlah Distraksi',
        data,
        backgroundColor: colors,
        borderRadius: 6,
        borderSkipped: false,
      }],
    },
    options: chartDefaults({
      scales: {
        y: { beginAtZero:true, ticks:{ color:'#8884aa', stepSize:1 }, grid:{ color:'rgba(255,255,255,.05)' } },
        x: { ticks:{ color:'#8884aa', maxRotation:45 }, grid:{ display:false } },
      },
    }),
  });
}

/* Chart 3: Distraction type pie */
function renderDistTypeChart(sessions) {
  const ctx = $('chart-dist-type').getContext('2d');
  if (charts.distType) charts.distType.destroy();

  // Count all distraction types across sessions
  const counts = {};
  sessions.forEach(s => {
    (s.distractions || []).forEach(d => {
      counts[d.type] = (counts[d.type] || 0) + 1;
    });
  });

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total === 0) {
    dom.pieLegend.innerHTML = '<p style="color:var(--text-dim);font-size:.8rem;text-align:center">Belum ada data distraksi</p>';
    return;
  }

  const palette = ['#7c6aff','#06d6a0','#ffd166','#ff6b6b','#4ecdc4','#ff9f43'];
  const labels  = Object.keys(counts).map(k => DIST_LABELS[k] || k);
  const data    = Object.values(counts);

  charts.distType = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: palette,
        borderColor: '#13132a',
        borderWidth: 3,
        hoverOffset: 8,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => {
              const pct = Math.round((ctx.parsed / total) * 100);
              return ` ${ctx.label}: ${ctx.parsed} (${pct}%)`;
            },
          },
          backgroundColor: '#1a1a35',
          borderColor: '#2a2a50',
          borderWidth: 1,
          titleColor: '#f0eeff',
          bodyColor: '#8884aa',
        },
      },
    },
  });

  // Custom legend
  dom.pieLegend.innerHTML = labels.map((l, i) => `
    <div class="pie-legend-item">
      <div class="pie-dot" style="background:${palette[i % palette.length]}"></div>
      <span>${l}</span>
    </div>
  `).join('');
}

/* Chart 4: Productive hours (distraction count by hour) */
function renderProductiveHoursChart(sessions) {
  const ctx = $('chart-productive-hours').getContext('2d');
  if (charts.productiveHours) charts.productiveHours.destroy();

  // Aggregate distraction count by hour
  const hourCounts = Array(24).fill(0);
  const hourSessions = Array(24).fill(0);
  sessions.forEach(s => {
    if (s.hour !== undefined) {
      hourCounts[s.hour]   += s.distCount;
      hourSessions[s.hour] += 1;
    }
  });

  // Only show hours that have data
  const activeHours = hourSessions.map((n, h) => n > 0 ? h : null).filter(h => h !== null);
  if (!activeHours.length) return;

  const labels = activeHours.map(h => `${String(h).padStart(2,'0')}:00`);
  const data   = activeHours.map(h => hourSessions[h] ? (hourCounts[h] / hourSessions[h]).toFixed(1) : 0);

  // Color: lower = more productive (green), higher = less productive (red)
  const maxVal = Math.max(...data.map(Number));
  const colors = data.map(v => {
    const ratio = maxVal > 0 ? Number(v) / maxVal : 0;
    if (ratio < 0.33) return '#06d6a0';
    if (ratio < 0.67) return '#ffd166';
    return '#ff6b6b';
  });

  charts.productiveHours = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Rata-rata Distraksi',
        data,
        backgroundColor: colors,
        borderRadius: 5,
        borderSkipped: false,
      }],
    },
    options: chartDefaults({
      scales: {
        y: { beginAtZero:true, ticks:{ color:'#8884aa' }, grid:{ color:'rgba(255,255,255,.05)' } },
        x: { ticks:{ color:'#8884aa' }, grid:{ display:false } },
      },
    }),
  });
}

/* Shared chart option factory */
function chartDefaults(extra = {}) {
  return {
    responsive: true,
    maintainAspectRatio: true,
    animation: { duration: 600 },
    plugins: {
      legend: {
        labels: { color: '#8884aa', boxWidth: 12, padding: 14, font: { size: 11 } },
      },
      tooltip: {
        backgroundColor: '#1a1a35',
        borderColor: '#2a2a50',
        borderWidth: 1,
        titleColor: '#f0eeff',
        bodyColor: '#8884aa',
        padding: 10,
      },
    },
    ...extra,
  };
}

/* Clear all data */
dom.btnClearData.addEventListener('click', () => {
  if (confirm('Hapus semua data? Tindakan ini tidak bisa dibatalkan.')) {
    appData = defaultData();
    saveData(appData);
    // Destroy charts
    Object.values(charts).forEach(c => c && c.destroy());
    charts = {};
    renderAnalytics();
    showToast('🗑', 'Semua data dihapus');
  }
});

/* ─────────────────────────────────────────────
   TOAST NOTIFICATION
───────────────────────────────────────────── */
let toastTimeout;
function showToast(icon, msg) {
  dom.toastIcon.textContent = icon;
  dom.toastMsg.textContent  = msg;
  dom.toast.classList.remove('hidden');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => dom.toast.classList.add('hidden'), 2200);
}

/* ─────────────────────────────────────────────
   WEB AUDIO BEEP
───────────────────────────────────────────── */
function playBeep(freq = 880, gain = 0.1, duration = 0.4) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const vol = ctx.createGain();
    osc.connect(vol);
    vol.connect(ctx.destination);
    osc.frequency.value = freq;
    osc.type = 'sine';
    vol.gain.setValueAtTime(gain, ctx.currentTime);
    vol.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch (_) { /* audio not available */ }
}

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */
function avg(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

/* ─────────────────────────────────────────────
   INIT
───────────────────────────────────────────── */
(function init() {
  // Set up ring circumference CSS var for the SVG element
  dom.ringProgress.style.strokeDasharray = STROKE;
  dom.ringProgress.style.strokeDashoffset = 0;

  // Init timer display
  updateTimerDisplay();
  updateRing(1);

  // Show timer screen
  showScreen('timer');

  console.log('%c🧠 Pelatih Fokus loaded', 'color:#7c6aff;font-weight:bold;font-size:14px');
})();
