/* cal.js — Calculadora Ultra Pro
   Lógica completa: evaluación, memoria, historial,
   animaciones avanzadas, teclado, accesibilidad
   ---------------------------------------------------------------- */

'use strict';

/* ─── Estado global ────────────────────────────────────────────── */
const display = document.getElementById('display');
const exprPreview = document.getElementById('expr-preview');
const historyList = document.getElementById('history-list');
const historyPanel = document.getElementById('history-panel');
const historyToggle = document.getElementById('history-toggle');
const clearHistBtn = document.getElementById('clear-hist');
const memValEl = document.getElementById('mem-val');
const memoryPill = document.getElementById('memory-pill');
const toastEl = document.getElementById('toast');

let history = JSON.parse(localStorage.getItem('calc_history') || '[]');
let memory = parseFloat(localStorage.getItem('calc_memory') || '0') || 0;
let lastResult = null;
let justCalculated = false;

/* ─── Utilidades ───────────────────────────────────────────────── */
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function showToast(msg, duration = 1800) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastEl._timer);
  toastEl._timer = setTimeout(() => toastEl.classList.remove('show'), duration);
}

function formatNumber(n) {
  if (typeof n !== 'number' || !isFinite(n)) return String(n);
  // Máximo 10 decimales significativos, sin trailing zeros
  const formatted = parseFloat(n.toPrecision(10)).toString();
  return formatted;
}

function adjustDisplaySize(value) {
  const len = String(value).length;
  display.classList.remove('shrink', 'xs-shrink');
  if (len > 18) display.classList.add('xs-shrink');
  else if (len > 10) display.classList.add('shrink');
}

/* ─── Expresión y evaluación ───────────────────────────────────── */
function sanitizeExpression(expr) {
  // Convierte % -> /100 aplicado al último número
  expr = expr.replace(/(\d+(?:\.\d+)?)%/g, '($1/100)');
  // Solo caracteres seguros
  if (!/^[0-9+\-*/().\s]+$/.test(expr)) return null;
  return expr;
}

function evaluateExpression(expr) {
  const sanitized = sanitizeExpression(expr);
  if (sanitized === null) throw new Error('Expresión inválida');
  // eslint-disable-next-line no-new-func
  const result = new Function('return ' + sanitized)();
  if (typeof result !== 'number' || !isFinite(result)) throw new Error('Resultado no finito');
  return result;
}

/* ─── Display helpers ──────────────────────────────────────────── */
function appendValue(value) {
  // Si acabamos de calcular y se escribe un número, reinicia
  if (justCalculated && /\d/.test(value)) {
    display.value = '';
    exprPreview.textContent = '';
    justCalculated = false;
  }
  justCalculated = false;

  // Prevenir punto duplicado en el segmento actual
  if (value === '.') {
    const parts = display.value.split(/[+\-*/]/);
    const last = parts[parts.length - 1] || '';
    if (last.includes('.')) return;
  }

  // Si empieza con 0 y se escribe dígito, reemplaza
  if (display.value === '0' && /^\d$/.test(value)) {
    display.value = value;
  } else {
    display.value += value;
  }

  adjustDisplaySize(display.value);
  animateButtonForValue(value);
}

function clearDisplay() {
  display.value = '';
  exprPreview.textContent = '';
  justCalculated = false;
  lastResult = null;
  animateBtnByOnclick('clearDisplay');
}

function backspace() {
  display.value = display.value.slice(0, -1);
  adjustDisplaySize(display.value);
}

function toggleSign() {
  if (!display.value) return;
  const m = display.value.match(/(.*?)([-]?\d+(?:\.\d+)?)$/);
  if (m) {
    const prefix = m[1] || '';
    const num = parseFloat(m[2]);
    display.value = prefix + formatNumber(-num);
    adjustDisplaySize(display.value);
  }
}

function percent() {
  if (!display.value) return;
  display.value += '%';
}

/* ─── Calcular resultado ───────────────────────────────────────── */
function calculateResult() {
  const expr = display.value.trim();
  if (!expr) return;
  try {
    const res = evaluateExpression(expr);
    const resStr = formatNumber(res);

    // Guarda preview de la expresión
    exprPreview.textContent = display.value + ' =';

    display.value = resStr;
    adjustDisplaySize(resStr);

    lastResult = res;
    justCalculated = true;

    pushHistory(expr, res);
    triggerResultPop();
    triggerEqPulse();
  } catch (err) {
    display.value = 'Error';
    exprPreview.textContent = '';
    triggerShake();
  }
}

/* ─── Memoria ──────────────────────────────────────────────────── */
function memoryClear() {
  memory = 0;
  persistMemory();
  updateMemoryUI();
  showToast('Memoria limpiada');
}
function memoryRecall() {
  if (memory === 0) { showToast('Memoria vacía'); return; }
  if (justCalculated) { display.value = ''; justCalculated = false; }
  display.value += formatNumber(memory);
  adjustDisplaySize(display.value);
  showToast('Memoria: ' + formatNumber(memory));
}
function memoryAdd() {
  try {
    const val = evaluateExpression(display.value || '0');
    memory = (memory || 0) + val;
    persistMemory();
    updateMemoryUI();
    showToast('M+ → ' + formatNumber(memory));
  } catch (e) { showToast('Expresión inválida'); }
}
function memorySub() {
  try {
    const val = evaluateExpression(display.value || '0');
    memory = (memory || 0) - val;
    persistMemory();
    updateMemoryUI();
    showToast('M− → ' + formatNumber(memory));
  } catch (e) { showToast('Expresión inválida'); }
}

function persistMemory() { localStorage.setItem('calc_memory', String(memory)); }
function updateMemoryUI() {
  if (memValEl) memValEl.textContent = formatNumber(memory);
  if (memoryPill) memoryPill.classList.toggle('active', memory !== 0);
}

/* ─── Historial ────────────────────────────────────────────────── */
function pushHistory(expr, result) {
  history.unshift({ t: Date.now(), expr, result });
  history = history.slice(0, 50);
  localStorage.setItem('calc_history', JSON.stringify(history));
  renderHistory();
}

function renderHistory() {
  if (!historyList) return;
  if (!history.length) {
    historyList.innerHTML = '<div class="hist-empty">Sin historial</div>';
    return;
  }
  historyList.innerHTML = history.map((h, i) => {
    const expr = escapeHtml(h.expr || h.v || '');
    const result = h.result !== undefined ? escapeHtml(formatNumber(h.result)) : '';
    return `
      <div class="hist-item" tabindex="0" data-index="${i}"
           onclick="loadHistoryItem(${i})"
           onkeydown="if(event.key==='Enter') loadHistoryItem(${i})">
        <span>${expr}</span>
        ${result ? `<span class="result-part"> = ${result}</span>` : ''}
      </div>`;
  }).join('');
}

function loadHistoryItem(index) {
  const item = history[index];
  if (!item) return;
  display.value = formatNumber(item.result || 0);
  adjustDisplaySize(display.value);
  justCalculated = true;
  // Cierra el historial
  toggleHistory(false);
}

function toggleHistory(forceClose) {
  const expanded = forceClose === false ? true
    : historyToggle.getAttribute('aria-expanded') === 'true';

  historyToggle.setAttribute('aria-expanded', String(!expanded));
  if (expanded) {
    historyPanel.classList.remove('open');
  } else {
    historyPanel.classList.add('open');
    renderHistory();
  }
}

if (clearHistBtn) {
  clearHistBtn.addEventListener('click', () => {
    history = [];
    localStorage.removeItem('calc_history');
    renderHistory();
    showToast('Historial limpiado');
  });
}

/* ─── Animaciones ──────────────────────────────────────────────── */
function triggerShake() {
  display.classList.remove('shake');
  void display.offsetWidth; // reflow
  display.classList.add('shake');
  display.addEventListener('animationend', () => display.classList.remove('shake'), { once: true });
}

function triggerResultPop() {
  display.classList.remove('result-pop');
  void display.offsetWidth;
  display.classList.add('result-pop');
  display.addEventListener('animationend', () => display.classList.remove('result-pop'), { once: true });
}

function triggerEqPulse() {
  const eqBtn = document.querySelector('.btn-eq');
  if (!eqBtn) return;
  eqBtn.classList.remove('pulse-eq');
  void eqBtn.offsetWidth;
  eqBtn.classList.add('pulse-eq');
  eqBtn.addEventListener('animationend', () => eqBtn.classList.remove('pulse-eq'), { once: true });
}

function animateButtonForValue(value) {
  const btns = Array.from(document.querySelectorAll('.btn'));
  const btn = btns.find(b => {
    const oc = b.getAttribute('onclick') || '';
    return b.textContent.trim() === value || oc.includes(`'${value}'`);
  });
  if (btn) createRipple(btn);
}

function animateBtnByOnclick(fnName) {
  const btn = document.querySelector(`[onclick*="${fnName}"]`);
  if (btn) createRipple(btn);
}

function createRipple(btn) {
  const ripple = document.createElement('span');
  ripple.className = 'btn-ripple';
  // Centrado en el botón
  const rect = btn.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  ripple.style.width = size + 'px';
  ripple.style.height = size + 'px';
  ripple.style.left = (rect.width / 2 - size / 2) + 'px';
  ripple.style.top = (rect.height / 2 - size / 2) + 'px';
  btn.appendChild(ripple);
  ripple.addEventListener('animationend', () => ripple.remove());
}

/* Marcar operador activo */
document.querySelectorAll('.btn-op').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.btn-op').forEach(b => b.classList.remove('active-op'));
    btn.classList.add('active-op');
  });
});
// Quitar marca al calcular
function clearActiveOp() {
  document.querySelectorAll('.btn-op').forEach(b => b.classList.remove('active-op'));
}

/* ─── Teclado ──────────────────────────────────────────────────── */
window.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' && e.target !== display) return;

  if (e.key >= '0' && e.key <= '9') { appendValue(e.key); return; }
  if (['+', '-', '*', '/', '.', '(', ')'].includes(e.key)) {
    if (e.key !== '-' || display.value === '') appendValue(e.key);
    else appendValue(e.key);
    return;
  }
  if (e.key === 'Enter' || e.key === '=') { e.preventDefault(); calculateResult(); clearActiveOp(); return; }
  if (e.key === 'Backspace') { e.preventDefault(); backspace(); return; }
  if (e.key === 'Escape' || e.key === 'Delete') { clearDisplay(); return; }
  if (e.key === '%') { percent(); return; }
  if (e.key.toLowerCase() === 'm' && e.ctrlKey) { e.preventDefault(); memoryRecall(); return; }
});

/* ─── Inicializar ──────────────────────────────────────────────── */
function init() {
  updateMemoryUI();
  renderHistory();

  if (historyToggle) {
    historyToggle.addEventListener('click', () => toggleHistory());
  }

  // Añadir ripple a todos los botones al click
  document.querySelectorAll('.btn, .mem-btn').forEach(btn => {
    btn.addEventListener('click', () => createRipple(btn));
  });
}

/* ─── Exports globales (para onclick en HTML) ──────────────────── */
window.appendValue = appendValue;
window.clearDisplay = clearDisplay;
window.calculateResult = calculateResult;
window.backspace = backspace;
window.toggleSign = toggleSign;
window.percent = percent;
window.memoryClear = memoryClear;
window.memoryRecall = memoryRecall;
window.memoryAdd = memoryAdd;
window.memorySub = memorySub;
window.loadHistoryItem = loadHistoryItem;
window.toggleHistory = toggleHistory;

/* ─── Boot ─────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', init);