const display = document.getElementById("display");

// Small UI helpers: create history panel and memory indicator if not present
const calculator = document.querySelector('.calculator');
let history = JSON.parse(localStorage.getItem('calc_history') || '[]');
let memory = parseFloat(localStorage.getItem('calc_memory') || '0') || 0;

function createUIExtras(){
  if (!document.getElementById('calc-extras')){
    const extras = document.createElement('div');
    extras.id = 'calc-extras';
    extras.innerHTML = `
      <div class="extras-row">
        <div id="memory-indicator">M: <span id="mem-val">${memory}</span></div>
        <button id="history-toggle" aria-expanded="false">Historial</button>
      </div>
      <div id="history" aria-live="polite"></div>
    `;
    calculator.insertBefore(extras, calculator.firstChild);
    document.getElementById('history-toggle').addEventListener('click', toggleHistory);
    renderHistory();
  }
}

createUIExtras();

function sanitizeExpression(expr){
  // Replace percentage like 50% -> (50/100)
  expr = expr.replace(/(\d+(?:\.\d+)?)%/g, '($1/100)');
  // Allow only safe characters: digits, operators, parentheses, decimal point and spaces
  if (!/^[0-9+\-*/().\s]+$/.test(expr)) return null;
  return expr;
}

function evaluateExpression(expr){
  const sanitized = sanitizeExpression(expr);
  if (sanitized === null) throw new Error('Expresión inválida');
  // Use Function instead of eval for slightly better scoping
  // eslint-disable-next-line no-new-func
  const fn = new Function('return ' + sanitized);
  const result = fn();
  if (typeof result === 'number' && !isFinite(result)) throw new Error('Resultado no finito');
  return result;
}

function appendValue(value) {
  // animate pressed button if available
  animateButtonForValue(value);
  // Prevent duplicate dots in a number segment
  if (value === '.'){
    const parts = display.value.split(/[+\-*/]/);
    const last = parts[parts.length-1] || '';
    if (last.includes('.')) return;
  }
  display.value = (display.value === '0' && value !== '.') ? value : display.value + value;
}

function clearDisplay() {
  display.value = '';
}

function backspace(){
  display.value = display.value.slice(0, -1);
}

function toggleSign(){
  try{
    if (!display.value) return;
    // try to toggle sign of the last number in the expression
    const m = display.value.match(/(.*?)([-+]?\d+(?:\.\d+)?)$/);
    if (m){
      const prefix = m[1] || '';
      const num = parseFloat(m[2]);
      const toggled = (-num).toString();
      display.value = prefix + toggled;
    }
  }catch(e){/* noop */}
}

function percent(){
  try{
    if (!display.value) return;
    display.value = display.value + '%';
  }catch(e){}
}

function calculateResult() {
  try {
    const expr = display.value || '';
    const res = evaluateExpression(expr);
    display.value = String(res);
    pushHistory(expr + ' = ' + res);
    animateEquals();
  } catch (err) {
    display.value = 'Error';
    animateError();
  }
}

// Memory functions
function memoryClear(){ memory = 0; persistMemory(); updateMemoryUI(); }
function memoryRecall(){ display.value += (memory || 0); }
function memoryAdd(){ try{ memory = (memory || 0) + Number(evaluateExpression(display.value || '0')); persistMemory(); updateMemoryUI(); }catch(e){} }
function memorySub(){ try{ memory = (memory || 0) - Number(evaluateExpression(display.value || '0')); persistMemory(); updateMemoryUI(); }catch(e){} }

function persistMemory(){ localStorage.setItem('calc_memory', String(memory)); }
function updateMemoryUI(){ const el = document.getElementById('mem-val'); if (el) el.textContent = memory; }

// History
function pushHistory(entry){ history.unshift({t: Date.now(), v: entry});
  history = history.slice(0, 30);
  localStorage.setItem('calc_history', JSON.stringify(history));
  renderHistory();
}

function renderHistory(){
  const container = document.getElementById('history');
  if (!container) return;
  container.innerHTML = history.length ? history.map(h => `<div class="hist-item">${escapeHtml(h.v)}</div>`).join('') : '<div class="hist-empty">Sin historial</div>';
}

function toggleHistory(){
  const btn = document.getElementById('history-toggle');
  const h = document.getElementById('history');
  const expanded = btn.getAttribute('aria-expanded') === 'true';
  btn.setAttribute('aria-expanded', String(!expanded));
  h.style.display = expanded ? 'none' : 'block';
}

function escapeHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// Animations for UI feedback
function animateButtonForValue(value){
  // find a button that has the textContent equal to value or the onclick contains the value
  const btns = Array.from(document.querySelectorAll('.buttons button'));
  const b = btns.find(x => x.textContent.trim() === value || (x.getAttribute('onclick')||'').includes(value));
  if (b){
    b.classList.add('btn-press');
    setTimeout(()=> b.classList.remove('btn-press'), 160);
  }
}

function animateEquals(){
  const btn = Array.from(document.querySelectorAll('.buttons button')).find(b => (b.getAttribute('onclick')||'').includes('calculateResult'));
  if (btn){
    btn.classList.add('btn-pulse');
    setTimeout(()=> btn.classList.remove('btn-pulse'), 420);
  }
}

function animateError(){
  display.classList.add('shake');
  setTimeout(()=> display.classList.remove('shake'), 550);
}

// Keyboard support
window.addEventListener('keydown', (e)=>{
  if (e.key >= '0' && e.key <= '9') return appendValue(e.key);
  if (['+','-','*','/','.','(',')'].includes(e.key)) { appendValue(e.key); return; }
  if (e.key === 'Enter') { e.preventDefault(); return calculateResult(); }
  if (e.key === 'Backspace') { e.preventDefault(); return backspace(); }
  if (e.key === 'Escape') { clearDisplay(); }
  if (e.key === '%') { percent(); }
  // memory shortcuts: Ctrl+M to recall
  if (e.key.toLowerCase() === 'm' && e.ctrlKey) { e.preventDefault(); memoryRecall(); }
});

// expose memory functions to global scope so inline onclicks (if added) can use them
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

// initialize UI
updateMemoryUI();
