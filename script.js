'use strict';

/* ============================================================
   Centro de Control Logístico — lógica del dashboard
   Estático, sin backend. Lee data/historico.json.
   ============================================================ */

let operations = [];
const charts = {};

const fmtInt = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 });
const fmtDec = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 1 });
const fmtMoney = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const PALETTE = {
  text: '#e8edf6', muted: '#8ba0bf', faint: '#5e7397', grid: '#243551',
  accent: '#36d1b7', accent2: '#5b9bff', warn: '#ffb454', bad: '#ff6b7a',
  series: ['#36d1b7', '#5b9bff', '#ffb454', '#ff6b7a', '#b48cff', '#4fd1c5', '#f6a5c0', '#9fb3c8']
};

/* ---------- Chart.js defaults ---------- */
function applyChartDefaults() {
  if (!window.Chart) return;
  Chart.defaults.color = PALETTE.muted;
  Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
  Chart.defaults.font.size = 12;
  Chart.defaults.borderColor = PALETTE.grid;
}

/* ============================================================
   Carga y normalización
   ============================================================ */
async function init() {
  applyChartDefaults();
  let raw;
  try {
    const res = await fetch('data/historico.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    raw = await res.json();
  } catch (err) {
    showBanner(
      `No se pudo cargar <strong>data/historico.json</strong>. Verifica que el archivo exista, ` +
      `sea JSON válido y que estés sirviendo el sitio por HTTP (GitHub Pages o un servidor local). ` +
      `Detalle: ${err.message}`, 'error');
    return;
  }

  if (!Array.isArray(raw)) {
    showBanner('El archivo <strong>historico.json</strong> debe contener una lista (array) de operaciones.', 'error');
    return;
  }
  if (raw.length === 0) {
    showBanner('El archivo <strong>historico.json</strong> está vacío. Carga datos para ver indicadores.');
    return;
  }

  operations = raw.map(normalizeOperation);
  setDataRange(operations);
  populateFilters(operations);
  document.querySelectorAll('select').forEach(s => s.addEventListener('change', updateDashboard));
  document.getElementById('resetFilters').addEventListener('click', resetFilters);
  updateDashboard();
}

function normalizeOperation(row) {
  row = row || {};
  const fechaIngreso = parseDate(row.fechaIngreso);
  const fechaAceptacion = parseDate(row.fechaAceptacion);
  const diasTransito = daysBetween(fechaIngreso, fechaAceptacion);
  const slaDias = toNum(row.slaDias);
  const hasSla = slaDias > 0 && diasTransito !== null;
  const atraso = hasSla ? Math.max(0, diasTransito - slaDias) : 0;
  return {
    despacho: str(row.despacho),
    proveedor: str(row.proveedor) || 'Sin proveedor',
    paisOrigen: str(row.paisOrigen) || 'Sin país',
    viaTransporte: str(row.viaTransporte) || 'Sin vía',
    puertoEmbarque: str(row.puertoEmbarque),
    puertoDestino: str(row.puertoDestino),
    fechaIngreso, fechaAceptacion,
    year: fechaIngreso ? fechaIngreso.getFullYear() : null,
    monthKey: fechaIngreso ? `${fechaIngreso.getFullYear()}-${pad(fechaIngreso.getMonth() + 1)}` : null,
    pesoKg: toNum(row.pesoKg),
    volumenM3: toNum(row.volumenM3),
    valorFlete: toNum(row.valorFlete),
    valorCif: toNum(row.valorCif),
    totalBultos: toNum(row.totalBultos),
    diasTransito,
    slaDias,
    atraso,
    cumpleSla: hasSla ? diasTransito <= slaDias : null
  };
}

/* ---------- Helpers de datos ---------- */
function toNum(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
function str(v) { return v == null ? '' : String(v).trim(); }
function pad(n) { return String(n).padStart(2, '0'); }
function parseDate(v) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}
function daysBetween(a, b) {
  if (!a || !b) return null;
  return Math.max(0, Math.round((b - a) / 86400000));
}
function unique(arr) { return [...new Set(arr.filter(v => v != null && v !== ''))]; }
function sum(data, key) { return data.reduce((acc, r) => acc + toNum(r[key]), 0); }
function average(values) { return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0; }

/* ============================================================
   Filtros
   ============================================================ */
function populateFilters(data) {
  fillSelect('filterYear', unique(data.map(x => x.year)).sort((a, b) => b - a));
  fillSelect('filterProvider', unique(data.map(x => x.proveedor)).sort());
  fillSelect('filterCountry', unique(data.map(x => x.paisOrigen)).sort());
  fillSelect('filterMode', unique(data.map(x => x.viaTransporte)).sort());
}

function fillSelect(id, values) {
  const select = document.getElementById(id);
  values.forEach(value => {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = value;
    select.appendChild(opt);
  });
}

function resetFilters() {
  ['filterYear', 'filterProvider', 'filterCountry', 'filterMode', 'filterSla']
    .forEach(id => { document.getElementById(id).value = 'all'; });
  updateDashboard();
}

function getFilteredData() {
  const year = document.getElementById('filterYear').value;
  const provider = document.getElementById('filterProvider').value;
  const country = document.getElementById('filterCountry').value;
  const mode = document.getElementById('filterMode').value;
  const sla = document.getElementById('filterSla').value;

  return operations.filter(r =>
    (year === 'all' || String(r.year) === year) &&
    (provider === 'all' || r.proveedor === provider) &&
    (country === 'all' || r.paisOrigen === country) &&
    (mode === 'all' || r.viaTransporte === mode) &&
    (sla === 'all' ||
      (sla === 'ok' && r.cumpleSla === true) ||
      (sla === 'late' && r.cumpleSla === false) ||
      (sla === 'none' && r.cumpleSla === null))
  );
}

/* ============================================================
   Render principal
   ============================================================ */
function updateDashboard() {
  const data = getFilteredData();
  if (data.length === 0) {
    showBanner('No hay operaciones que coincidan con los filtros seleccionados. Ajusta o limpia los filtros.');
  } else {
    hideBanner();
  }
  updateKpis(data);
  if (window.Chart) {
    try { updateCharts(data); } catch (e) { console.error('Chart render failed:', e); }
  }
  updateTable(data);
}

function updateKpis(data) {
  const totalOps = unique(data.map(x => x.despacho)).length || data.length;
  const totalWeight = sum(data, 'pesoKg');
  const totalVolume = sum(data, 'volumenM3');
  const totalCost = sum(data, 'valorFlete');
  const totalBultos = sum(data, 'totalBultos');
  const transitVals = data.map(x => x.diasTransito).filter(d => d != null && d > 0);
  const avgTransit = average(transitVals);

  const slaRows = data.filter(x => x.cumpleSla !== null);
  const slaOk = slaRows.length ? slaRows.filter(x => x.cumpleSla).length / slaRows.length : 0;
  const slaLate = slaRows.length ? 1 - slaOk : 0;
  const lateRows = slaRows.filter(x => x.cumpleSla === false);
  const avgDelay = average(lateRows.map(x => x.atraso));

  setText('kpiOperations', fmtInt.format(totalOps));
  setText('kpiBultos', `${fmtInt.format(totalBultos)} bultos`);
  setText('kpiWeight', fmtInt.format(totalWeight));
  setText('kpiVolume', fmtDec.format(totalVolume));
  setText('kpiCost', fmtMoney.format(totalCost));
  setText('kpiCostKg', totalWeight ? fmtMoney.format(totalCost / totalWeight) : '—');
  setText('kpiCostM3', totalVolume ? fmtMoney.format(totalCost / totalVolume) : '—');
  setText('kpiTransit', transitVals.length ? `${fmtDec.format(avgTransit)} d` : '—');
  setText('kpiSla', slaRows.length ? `${fmtDec.format(slaOk * 100)}%` : '—');
  setText('kpiSlaFoot', slaRows.length
    ? `${fmtDec.format(slaLate * 100)}% fuera · ${fmtDec.format(avgDelay)} d atraso prom.`
    : 'sin SLA definido');
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

/* ============================================================
   Gráficos
   ============================================================ */
function updateCharts(data) {
  const months = sortedMonthKeys(data);
  const opsByMonth = months.map(m => data.filter(x => x.monthKey === m).length);
  const costByMonth = months.map(m => sum(data.filter(x => x.monthKey === m), 'valorFlete'));
  const weightByMonth = months.map(m => sum(data.filter(x => x.monthKey === m), 'pesoKg'));
  const monthLabels = months.map(prettyMonth);

  const providers = topN(groupSum(data, 'proveedor', 'valorFlete'), 8);
  const countries = topN(groupCount(data, 'paisOrigen'), 8);
  const modes = groupCount(data, 'viaTransporte');
  const sla = {
    Cumple: data.filter(x => x.cumpleSla === true).length,
    'Fuera SLA': data.filter(x => x.cumpleSla === false).length,
    'Sin SLA': data.filter(x => x.cumpleSla === null).length
  };

  bar('chartOperations', monthLabels, opsByMonth, 'Operaciones', PALETTE.accent2);
  line('chartCost', monthLabels, costByMonth, 'Gasto (CLP)', PALETTE.accent, { money: true });
  bar('chartWeight', monthLabels, weightByMonth, 'Peso (kg)', PALETTE.warn);
  doughnut('chartSla', Object.keys(sla), Object.values(sla),
    [PALETTE.good, PALETTE.bad, PALETTE.faint]);
  hbar('chartProviders', Object.keys(providers), Object.values(providers), 'Gasto', PALETTE.accent, { money: true });
  hbar('chartCountries', Object.keys(countries), Object.values(countries), 'Operaciones', PALETTE.accent2);
  doughnut('chartModes', Object.keys(modes), Object.values(modes), PALETTE.series);
}

function sortedMonthKeys(data) {
  return unique(data.map(x => x.monthKey)).sort();
}
function prettyMonth(key) {
  const [y, m] = key.split('-');
  return `${MONTHS_ES[Number(m) - 1]} ${y.slice(2)}`;
}
function groupCount(data, key) {
  return data.reduce((acc, r) => { const k = r[key] || 'Sin dato'; acc[k] = (acc[k] || 0) + 1; return acc; }, {});
}
function groupSum(data, key, valueKey) {
  return data.reduce((acc, r) => { const k = r[key] || 'Sin dato'; acc[k] = (acc[k] || 0) + toNum(r[valueKey]); return acc; }, {});
}
function topN(obj, n) {
  return Object.fromEntries(Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n));
}

/* ---------- Constructores de gráficos ---------- */
function baseScales(money) {
  return {
    x: { grid: { color: PALETTE.grid }, ticks: { color: PALETTE.muted } },
    y: {
      beginAtZero: true, grid: { color: PALETTE.grid },
      ticks: { color: PALETTE.muted, callback: v => money ? compactMoney(v) : fmtInt.format(v) }
    }
  };
}
function compactMoney(v) {
  if (v >= 1e9) return `$${fmtDec.format(v / 1e9)}B`;
  if (v >= 1e6) return `$${fmtDec.format(v / 1e6)}M`;
  if (v >= 1e3) return `$${fmtInt.format(v / 1e3)}K`;
  return `$${fmtInt.format(v)}`;
}
function moneyTooltip(money) {
  return { callbacks: { label: c => `${c.dataset.label}: ${money ? fmtMoney.format(c.parsed.y ?? c.parsed.x) : fmtInt.format(c.parsed.y ?? c.parsed.x)}` } };
}

function destroy(id) { if (charts[id]) { charts[id].destroy(); delete charts[id]; } }
function ctx(id) { return document.getElementById(id); }

function bar(id, labels, values, label, color, opts = {}) {
  destroy(id);
  charts[id] = new Chart(ctx(id), {
    type: 'bar',
    data: { labels, datasets: [{ label, data: values, backgroundColor: color, borderRadius: 6, maxBarThickness: 38 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: moneyTooltip(opts.money) }, scales: baseScales(opts.money) }
  });
}
function hbar(id, labels, values, label, color, opts = {}) {
  destroy(id);
  charts[id] = new Chart(ctx(id), {
    type: 'bar',
    data: { labels, datasets: [{ label, data: values, backgroundColor: color, borderRadius: 6 }] },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: moneyTooltip(opts.money) },
      scales: {
        x: { beginAtZero: true, grid: { color: PALETTE.grid }, ticks: { color: PALETTE.muted, callback: v => opts.money ? compactMoney(v) : fmtInt.format(v) } },
        y: { grid: { display: false }, ticks: { color: PALETTE.muted } }
      }
    }
  });
}
function line(id, labels, values, label, color, opts = {}) {
  destroy(id);
  charts[id] = new Chart(ctx(id), {
    type: 'line',
    data: { labels, datasets: [{ label, data: values, borderColor: color, backgroundColor: 'rgba(54,209,183,.14)', fill: true, tension: .32, pointRadius: 3, pointBackgroundColor: color }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: moneyTooltip(opts.money) }, scales: baseScales(opts.money) }
  });
}
function doughnut(id, labels, values, colors) {
  destroy(id);
  charts[id] = new Chart(ctx(id), {
    type: 'doughnut',
    data: { labels, datasets: [{ data: values, backgroundColor: colors, borderColor: PALETTE.grid, borderWidth: 2 }] },
    options: { responsive: true, maintainAspectRatio: false, cutout: '62%', plugins: { legend: { position: 'bottom', labels: { color: PALETTE.muted, padding: 14, usePointStyle: true } } } }
  });
}

/* ============================================================
   Tabla
   ============================================================ */
function updateTable(data) {
  const tbody = document.getElementById('operationsTable');
  tbody.innerHTML = '';
  setText('tableCount', `${fmtInt.format(data.length)} registros`);

  if (data.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="9">Sin operaciones para mostrar</td></tr>';
    return;
  }

  const rows = [...data]
    .sort((a, b) => (b.fechaIngreso?.getTime() || 0) - (a.fechaIngreso?.getTime() || 0))
    .slice(0, 30);

  const frag = document.createDocumentFragment();
  rows.forEach(r => {
    const tr = document.createElement('tr');
    let slaText, slaClass;
    if (r.cumpleSla === null) { slaText = 'Sin SLA'; slaClass = 'status-none'; }
    else if (r.cumpleSla) { slaText = 'Cumple'; slaClass = 'status-ok'; }
    else { slaText = `+${r.atraso} d`; slaClass = 'status-late'; }

    tr.appendChild(td(r.despacho || '—'));
    tr.appendChild(td(r.fechaIngreso ? r.fechaIngreso.toISOString().slice(0, 10) : '—'));
    tr.appendChild(td(r.proveedor));
    tr.appendChild(td(r.paisOrigen));
    tr.appendChild(td(r.viaTransporte));
    tr.appendChild(td(fmtInt.format(r.pesoKg), 'num'));
    tr.appendChild(td(fmtMoney.format(r.valorFlete), 'num'));
    tr.appendChild(td(r.diasTransito != null ? r.diasTransito : '—', 'num'));
    tr.appendChild(td(slaText, `tag ${slaClass}`));
    frag.appendChild(tr);
  });
  tbody.appendChild(frag);
}

function td(text, cls) {
  const cell = document.createElement('td');
  cell.textContent = text;
  if (cls) cell.className = cls;
  return cell;
}

/* ============================================================
   UI auxiliar
   ============================================================ */
function setDataRange(data) {
  const dates = data.map(x => x.fechaIngreso).filter(Boolean).sort((a, b) => a - b);
  const el = document.getElementById('dataRange');
  if (!dates.length) { el.textContent = `${data.length} ops`; return; }
  const from = dates[0], to = dates[dates.length - 1];
  el.textContent = `${prettyMonth(`${from.getFullYear()}-${pad(from.getMonth() + 1)}`)} – ${prettyMonth(`${to.getFullYear()}-${pad(to.getMonth() + 1)}`)} · ${fmtInt.format(data.length)} ops`;
}

function showBanner(html, type) {
  const b = document.getElementById('banner');
  b.innerHTML = html;
  b.className = 'banner' + (type === 'error' ? ' error' : '');
  b.hidden = false;
}
function hideBanner() {
  const b = document.getElementById('banner');
  b.hidden = true;
}

document.addEventListener('DOMContentLoaded', init);
