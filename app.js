// Telegram Web App - расширяем viewport
if (window.Telegram?.WebApp) {
  window.Telegram.WebApp.ready();
  document.body.style.backgroundColor = window.Telegram.WebApp.themeParams?.bg_color || '#1c1c1e';
}

const STORAGE_KEY = 'workout_tracker_data';

// Состояние
let currentDate = new Date();
let editingExerciseId = null;

// Форматирование даты
function formatDateKey(date) {
  return date.toISOString().slice(0, 10);
}

function formatDateTitle(date) {
  const options = { day: 'numeric', month: 'long', year: 'numeric' };
  return date.toLocaleDateString('ru-RU', options);
}

// Хранение данных
function loadData() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : { workouts: {} };
  } catch {
    return { workouts: {} };
  }
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function getWorkoutsForDate(date) {
  const data = loadData();
  const key = formatDateKey(date);
  return data.workouts[key] || [];
}

function saveWorkoutsForDate(date, workouts) {
  const data = loadData();
  const key = formatDateKey(date);
  data.workouts[key] = workouts;
  saveData(data);
}

// Генерация ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// DOM
const workoutList = document.getElementById('workoutList');
const dateTitle = document.getElementById('dateTitle');
const btnPrevDay = document.getElementById('btnPrevDay');
const btnNextDay = document.getElementById('btnNextDay');
const addExerciseBtn = document.getElementById('addExercise');
const exerciseModal = document.getElementById('exerciseModal');
const modalTitle = document.getElementById('modalTitle');
const exerciseForm = document.getElementById('exerciseForm');
const inputName = document.getElementById('inputName');
const inputWeight = document.getElementById('inputWeight');
const inputSetsCount = document.getElementById('inputSetsCount');
const setsEditor = document.getElementById('setsEditor');
const btnCancel = document.getElementById('btnCancel');

// Рендер списка упражнений
function renderWorkouts() {
  const workouts = getWorkoutsForDate(currentDate);
  dateTitle.textContent = formatDateTitle(currentDate);

  if (workouts.length === 0) {
    workoutList.innerHTML = `
      <div class="empty-state">
        <p>Нет упражнений на этот день</p>
        <p>Нажмите «Добавить упражнение»</p>
      </div>
    `;
    return;
  }

  workoutList.innerHTML = workouts.map(ex => `
    <div class="exercise-card" data-id="${ex.id}">
      <div class="exercise-header">
        <span class="exercise-name">${escapeHtml(ex.name)}</span>
        <div class="exercise-actions">
          <button type="button" class="btn-edit" data-id="${ex.id}" title="Редактировать">✏️</button>
          <button type="button" class="btn-delete" data-id="${ex.id}" title="Удалить">🗑️</button>
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

  // Обработчики
  workoutList.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => openEditModal(btn.dataset.id));
  });
  workoutList.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', () => deleteExercise(btn.dataset.id));
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Модальное окно
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
  const workouts = getWorkoutsForDate(currentDate);
  const ex = workouts.find(e => e.id === id);
  if (!ex) return;

  editingExerciseId = id;
  modalTitle.textContent = 'Редактировать упражнение';
  inputName.value = ex.name;
  inputWeight.value = ex.weight || '';
  inputSetsCount.value = (ex.sets || []).length || 4;
  renderSetsEditor((ex.sets || []).length || 4, ex.sets || []);
  exerciseModal.classList.add('open');
}

function closeModal() {
  exerciseModal.classList.remove('open');
  editingExerciseId = null;
}

// Редактор подходов в модалке
function renderSetsEditor(count, sets) {
  const cnt = Math.min(Math.max(parseInt(count, 10) || 4, 1), 10);
  setsEditor.innerHTML = `
    <h3>Подходы (количество повторений)</h3>
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
  return Array.from(rows).map(row => ({
    planned: parseInt(row.querySelector('[data-planned]').value, 10) || null,
    actual: parseInt(row.querySelector('[data-actual]').value, 10) ?? null
  }));
}

// Создание/обновление подхода при изменении количества
inputSetsCount?.addEventListener('change', () => {
  const count = parseInt(inputSetsCount.value, 10) || 4;
  const current = getSetsFromEditor();
  renderSetsEditor(count, current);
});

// Сохранение упражнения
exerciseForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = inputName.value.trim();
  if (!name) return;

  const weight = parseFloat(inputWeight.value) || null;
  const sets = getSetsFromEditor();

  const workouts = getWorkoutsForDate(currentDate);

  if (editingExerciseId) {
    const idx = workouts.findIndex(e => e.id === editingExerciseId);
    if (idx >= 0) {
      workouts[idx] = { ...workouts[idx], name, weight, sets };
    }
  } else {
    workouts.push({ id: generateId(), name, weight, sets });
  }

  saveWorkoutsForDate(currentDate, workouts);
  closeModal();
  renderWorkouts();
});

function deleteExercise(id) {
  if (!confirm('Удалить упражнение?')) return;
  const workouts = getWorkoutsForDate(currentDate).filter(e => e.id !== id);
  saveWorkoutsForDate(currentDate, workouts);
  renderWorkouts();
}

// Дни
function changeDay(delta) {
  currentDate.setDate(currentDate.getDate() + delta);
  renderWorkouts();
}

btnPrevDay?.addEventListener('click', () => changeDay(-1));
btnNextDay?.addEventListener('click', () => changeDay(1));

addExerciseBtn?.addEventListener('click', openAddModal);
btnCancel?.addEventListener('click', closeModal);

exerciseModal?.addEventListener('click', (e) => {
  if (e.target === exerciseModal) closeModal();
});

// Инициализация
renderWorkouts();
