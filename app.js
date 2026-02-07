// Telegram Web App
if (window.Telegram?.WebApp) {
  window.Telegram.WebApp.ready();
  document.body.style.backgroundColor = window.Telegram.WebApp.themeParams?.bg_color || '#1c1c1e';
}

// ID пользователя (из Telegram или fallback)
function getUserId() {
  const user = window.Telegram?.WebApp?.initDataUnsafe?.user;
  return user ? `tg_${user.id}` : 'local';
}

const STORAGE_PREFIX = 'workout_tracker_';
const WEEKDAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']; // 0=Sun, 1=Mon...

// Состояние
let currentDate = new Date();
let editingExerciseId = null;
let editingPlanDayId = null;
let currentScreen = 'main';

// Загрузка/сохранение
function getStorageKey() {
  return STORAGE_PREFIX + getUserId();
}

function loadUserData() {
  try {
    const data = localStorage.getItem(getStorageKey());
    if (data) return JSON.parse(data);
  } catch {}
  return {
    trainingDays: [1, 3, 5],
    planDays: [],
    workouts: {}
  };
}

function saveUserData(data) {
  localStorage.setItem(getStorageKey(), JSON.stringify(data));
}

// Дата
function formatDateKey(date) {
  return date.toISOString().slice(0, 10);
}

function formatDateTitle(date) {
  const options = { day: 'numeric', month: 'long', year: 'numeric' };
  return date.toLocaleDateString('ru-RU', options);
}

function getDayOfWeek(date) {
  return date.getDay();
}

function isTrainingDay(date) {
  const data = loadUserData();
  return (data.trainingDays || []).includes(getDayOfWeek(date));
}

function getPlanDayForDate(date) {
  const data = loadUserData();
  const planDays = data.planDays || [];
  const trainingDays = (data.trainingDays || []).sort((a, b) => a - b);
  if (planDays.length === 0 || trainingDays.length === 0) return null;

  const dow = getDayOfWeek(date);
  const idx = trainingDays.indexOf(dow);
  if (idx === -1) return null;
  return planDays[idx % planDays.length];
}

function getWorkoutsForDate(date) {
  const data = loadUserData();
  return data.workouts[formatDateKey(date)] || null;
}

function saveWorkoutsForDate(date, exercises) {
  const data = loadUserData();
  data.workouts[formatDateKey(date)] = exercises;
  saveUserData(data);
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// DOM
const screenMain = document.getElementById('screenMain');
const screenProfile = document.getElementById('screenProfile');
const workoutList = document.getElementById('workoutList');
const dateTitle = document.getElementById('dateTitle');
const btnPrevDay = document.getElementById('btnPrevDay');
const btnNextDay = document.getElementById('btnNextDay');
const addExerciseBtn = document.getElementById('addExercise');
const btnProfile = document.getElementById('btnProfile');
const btnBackProfile = document.getElementById('btnBackProfile');
const daysGrid = document.getElementById('daysGrid');
const planDaysList = document.getElementById('planDaysList');
const addPlanDayBtn = document.getElementById('addPlanDay');
const btnSaveProfile = document.getElementById('btnSaveProfile');
const exerciseModal = document.getElementById('exerciseModal');
const modalTitle = document.getElementById('modalTitle');
const exerciseForm = document.getElementById('exerciseForm');
const inputName = document.getElementById('inputName');
const inputWeight = document.getElementById('inputWeight');
const inputSetsCount = document.getElementById('inputSetsCount');
const setsEditor = document.getElementById('setsEditor');
const btnCancel = document.getElementById('btnCancel');
const planDayModal = document.getElementById('planDayModal');
const planDayModalTitle = document.getElementById('planDayModalTitle');
const planDayForm = document.getElementById('planDayForm');
const inputPlanDayName = document.getElementById('inputPlanDayName');
const planDayExercises = document.getElementById('planDayExercises');
const btnAddExToPlan = document.getElementById('btnAddExToPlan');
const btnCancelPlanDay = document.getElementById('btnCancelPlanDay');

// Навигация
function showScreen(name) {
  currentScreen = name;
  screenMain.classList.toggle('active', name === 'main');
  screenProfile.classList.toggle('active', name === 'profile');
  if (name === 'main') renderWorkouts();
  else renderProfile();
}

// Главный экран: тренировки
function getExercisesForDate(date) {
  const saved = getWorkoutsForDate(date);
  if (saved && saved.length > 0) return saved;
  const planDay = getPlanDayForDate(date);
  if (!planDay) return [];
  return (planDay.exercises || []).map(ex => ({
    ...ex,
    id: generateId(),
    sets: (ex.sets || []).map(s => ({ planned: s.planned, actual: null }))
  }));
}

function renderWorkouts() {
  const date = new Date(currentDate);
  dateTitle.textContent = formatDateTitle(date);

  const isTrain = isTrainingDay(date);
  const exercises = getExercisesForDate(date);

  if (!isTrain) {
    workoutList.innerHTML = `
      <div class="empty-state">
        <p>В этот день нет тренировки</p>
        <p>Настрой дни в Профиле</p>
      </div>
    `;
    addExerciseBtn.style.display = 'none';
    return;
  }

  addExerciseBtn.style.display = 'block';

  if (exercises.length === 0) {
    workoutList.innerHTML = `
      <div class="empty-state">
        <p>Нет упражнений на этот день</p>
        <p>Добавь в Профиле или нажми ниже</p>
      </div>
    `;
  } else {
    workoutList.innerHTML = exercises.map(ex => `
      <div class="exercise-card" data-id="${ex.id}">
        <div class="exercise-header">
          <span class="exercise-name">${escapeHtml(ex.name)}</span>
          <div class="exercise-actions">
            <button type="button" class="btn-edit" data-id="${ex.id}">✏️</button>
            <button type="button" class="btn-delete" data-id="${ex.id}">🗑️</button>
          </div>
        </div>
        ${ex.weight ? `<div class="exercise-weight">${ex.weight} кг</div>` : ''}
        <div class="sets-row">
          ${(ex.sets || []).map((s, i) => `
            <div class="set-badge">
              <span>Подход ${i + 1}</span>
              <span class="rep-count">${s.actual ?? '—'}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');

    workoutList.querySelectorAll('.btn-edit').forEach(btn => {
      btn.addEventListener('click', () => openEditModal(btn.dataset.id));
    });
    workoutList.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', () => deleteExercise(btn.dataset.id));
    });
  }
}

function changeDay(delta) {
  currentDate.setDate(currentDate.getDate() + delta);
  renderWorkouts();
}

// Упражнение: модалка
function openAddModal() {
  editingExerciseId = null;
  modalTitle.textContent = 'Новое упражнение';
  exerciseForm.reset();
  inputName.value = '';
  inputWeight.value = '';
  inputSetsCount.value = '4';
  renderSetsEditor(4, []);
  exerciseModal.classList.add('open');
}

function openEditModal(id) {
  const exercises = getExercisesForDate(currentDate);
  const ex = exercises.find(e => e.id === id);
  if (!ex) return;

  editingExerciseId = id;
  modalTitle.textContent = 'Редактировать упражнение';
  inputName.value = ex.name;
  inputWeight.value = ex.weight || '';
  inputSetsCount.value = (ex.sets || []).length || 4;
  renderSetsEditor((ex.sets || []).length || 4, ex.sets || []);
  exerciseModal.classList.add('open');
}

function closeExerciseModal() {
  exerciseModal.classList.remove('open');
  editingExerciseId = null;
}

function renderSetsEditor(count, sets) {
  const cnt = Math.min(Math.max(parseInt(count, 10) || 4, 1), 10);
  setsEditor.innerHTML = `
    <h3>Подходы</h3>
    ${Array.from({ length: cnt }, (_, i) => {
      const s = sets[i] || { planned: '', actual: '' };
      return `
        <div class="set-input-row" data-set="${i}">
          <span>Подход ${i + 1}</span>
          <input type="number" placeholder="План" min="0" value="${s.planned ?? ''}" data-planned>
          <input type="number" placeholder="Сделано" min="0" value="${s.actual ?? ''}" data-actual>
        </div>
      `;
    }).join('')}
  `;
}

function getSetsFromEditor() {
  const rows = setsEditor.querySelectorAll('.set-input-row');
  return Array.from(rows).map(row => {
    const planned = row.querySelector('[data-planned]').value;
    const actual = row.querySelector('[data-actual]').value;
    return {
      planned: planned ? parseInt(planned, 10) : null,
      actual: actual !== '' ? parseInt(actual, 10) : null
    };
  });
}

inputSetsCount?.addEventListener('change', () => {
  const count = parseInt(inputSetsCount.value, 10) || 4;
  const current = getSetsFromEditor();
  renderSetsEditor(count, current);
});

exerciseForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = inputName.value.trim();
  if (!name) return;

  const weight = parseFloat(inputWeight.value) || null;
  const sets = getSetsFromEditor();

  const exercises = getExercisesForDate(currentDate).map(ex => ({ ...ex }));

  if (editingExerciseId) {
    const idx = exercises.findIndex(e => e.id === editingExerciseId);
    if (idx >= 0) {
      exercises[idx] = { ...exercises[idx], name, weight, sets };
    }
  } else {
    exercises.push({ id: generateId(), name, weight, sets });
  }

  saveWorkoutsForDate(currentDate, exercises);
  closeExerciseModal();
  renderWorkouts();
});

function deleteExercise(id) {
  if (!confirm('Удалить упражнение?')) return;
  const exercises = getExercisesForDate(currentDate).filter(e => e.id !== id);
  saveWorkoutsForDate(currentDate, exercises);
  renderWorkouts();
}

btnCancel?.addEventListener('click', closeExerciseModal);
exerciseModal?.addEventListener('click', (e) => {
  if (e.target === exerciseModal) closeExerciseModal();
});

// Профиль
function renderProfile() {
  const data = loadUserData();
  const trainingDays = data.trainingDays || [];
  const planDays = data.planDays || [];

  daysGrid.innerHTML = WEEKDAYS.map((name, dow) => `
    <label class="day-check ${trainingDays.includes(dow) ? 'active' : ''}">
      <input type="checkbox" data-dow="${dow}" ${trainingDays.includes(dow) ? 'checked' : ''}>
      <span>${name}</span>
    </label>
  `).join('');

  daysGrid.querySelectorAll('.day-check').forEach(el => {
    el.addEventListener('click', () => {
      el.classList.toggle('active', el.querySelector('input').checked);
    });
  });

  planDaysList.innerHTML = planDays.map((pd, i) => `
    <div class="plan-day-card" data-id="${pd.id}">
      <div class="plan-day-header">
        <span class="plan-day-name">${escapeHtml(pd.name)}</span>
        <span class="plan-day-ex-count">${(pd.exercises || []).length} упр.</span>
        <div>
          <button type="button" class="btn-edit btn-small" data-id="${pd.id}">✏️</button>
          <button type="button" class="btn-delete btn-small" data-id="${pd.id}">🗑️</button>
        </div>
      </div>
    </div>
  `).join('');

  planDaysList.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => openPlanDayModal(btn.dataset.id));
  });
  planDaysList.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', () => deletePlanDay(btn.dataset.id));
  });
}

btnSaveProfile?.addEventListener('click', () => {
  const data = loadUserData();
  const checkboxes = daysGrid.querySelectorAll('input[type="checkbox"]:checked');
  data.trainingDays = Array.from(checkboxes).map(cb => parseInt(cb.dataset.dow, 10)).sort((a, b) => a - b);
  saveUserData(data);
  showScreen('main');
});

function openPlanDayModal(id) {
  const data = loadUserData();
  if (id) {
    const pd = data.planDays.find(p => p.id === id);
    if (!pd) return;
    editingPlanDayId = id;
    planDayModalTitle.textContent = 'Редактировать день';
    inputPlanDayName.value = pd.name;
    renderPlanDayExercises(pd.exercises || []);
  } else {
    editingPlanDayId = null;
    planDayModalTitle.textContent = 'Новый день в плане';
    inputPlanDayName.value = '';
    renderPlanDayExercises([]);
  }
  planDayModal.classList.add('open');
}

function closePlanDayModal() {
  planDayModal.classList.remove('open');
  editingPlanDayId = null;
}

function renderPlanDayExercises(exercises) {
  planDayExercises.innerHTML = exercises.map((ex, i) => `
    <div class="plan-ex-row" data-i="${i}">
      <input type="text" placeholder="Название" value="${escapeHtml(ex.name)}" class="plan-ex-name">
      <input type="number" placeholder="Вес" min="0" value="${ex.weight || ''}" class="plan-ex-weight">
      <input type="number" placeholder="Подходы" min="1" value="${(ex.sets || []).length || 4}" class="plan-ex-sets">
      <button type="button" class="btn-delete btn-tiny" data-i="${i}">✕</button>
    </div>
  `).join('');

  planDayExercises.querySelectorAll('.btn-tiny').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = parseInt(btn.dataset.i, 10);
      const rows = planDayExercises.querySelectorAll('.plan-ex-row');
      const exs = [];
      rows.forEach((row, idx) => {
        if (idx === i) return;
        const name = row.querySelector('.plan-ex-name').value.trim();
        if (!name) return;
        const weight = parseFloat(row.querySelector('.plan-ex-weight').value) || null;
        const setCount = parseInt(row.querySelector('.plan-ex-sets').value, 10) || 4;
        exs.push({
          name,
          weight,
          sets: Array.from({ length: setCount }, () => ({ planned: null, actual: null }))
        });
      });
      renderPlanDayExercises(exs);
    });
  });
}

function getPlanDayExercisesFromEditor() {
  const rows = planDayExercises.querySelectorAll('.plan-ex-row');
  return Array.from(rows).map(row => {
    const name = row.querySelector('.plan-ex-name').value.trim();
    if (!name) return null;
    const weight = parseFloat(row.querySelector('.plan-ex-weight').value) || null;
    const setCount = parseInt(row.querySelector('.plan-ex-sets').value, 10) || 4;
    return {
      name,
      weight,
      sets: Array.from({ length: Math.max(1, setCount) }, () => ({ planned: null, actual: null }))
    };
  }).filter(Boolean);
}

btnAddExToPlan?.addEventListener('click', () => {
  const exs = getPlanDayExercisesFromEditor();
  exs.push({ name: '', weight: null, sets: [{ planned: null, actual: null }] });
  renderPlanDayExercises(exs);
});

planDayForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = inputPlanDayName.value.trim();
  if (!name) return;

  const exercises = getPlanDayExercisesFromEditor();
  const data = loadUserData();
  data.planDays = data.planDays || [];

  if (editingPlanDayId) {
    const idx = data.planDays.findIndex(p => p.id === editingPlanDayId);
    if (idx >= 0) {
      data.planDays[idx] = { ...data.planDays[idx], name, exercises };
    }
  } else {
    data.planDays.push({ id: generateId(), name, exercises });
  }

  saveUserData(data);
  closePlanDayModal();
  renderProfile();
});

function deletePlanDay(id) {
  if (!confirm('Удалить этот день из плана?')) return;
  const data = loadUserData();
  data.planDays = (data.planDays || []).filter(p => p.id !== id);
  saveUserData(data);
  renderProfile();
}

btnCancelPlanDay?.addEventListener('click', closePlanDayModal);
planDayModal?.addEventListener('click', (e) => {
  if (e.target === planDayModal) closePlanDayModal();
});

// События
btnPrevDay?.addEventListener('click', () => changeDay(-1));
btnNextDay?.addEventListener('click', () => changeDay(1));
addExerciseBtn?.addEventListener('click', openAddModal);
btnProfile?.addEventListener('click', () => showScreen('profile'));
btnBackProfile?.addEventListener('click', () => showScreen('main'));
addPlanDayBtn?.addEventListener('click', () => openPlanDayModal(null));

// Инициализация
screenMain.classList.add('active');
screenProfile.classList.remove('active');
renderWorkouts();
