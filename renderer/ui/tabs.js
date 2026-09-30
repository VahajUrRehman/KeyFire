// Tab bar: one page visible at a time, arrow keys move between tabs, the last tab is remembered.
import { $ } from './core.js';

const KEY = 'sk-tab';
const tabs = () => [...document.querySelectorAll('.tab')];

function show(id) {
  tabs().forEach((t) => {
    const on = t.dataset.tab === id;
    t.setAttribute('aria-selected', on);
    t.tabIndex = on ? 0 : -1;
  });
  document.querySelectorAll('.page').forEach((p) => { p.hidden = p.id !== 'page-' + id; });
  $('#pages').scrollTop = 0;
  try { localStorage.setItem(KEY, id); } catch {}
}

export function initTabs() {
  let start = 'play';
  try { start = localStorage.getItem(KEY) || 'play'; } catch {}
  if (!tabs().some((t) => t.dataset.tab === start)) start = 'play';
  tabs().forEach((t) => {
    t.addEventListener('click', () => show(t.dataset.tab));
    t.addEventListener('keydown', (e) => {
      const all = tabs();
      const i = all.indexOf(t);
      const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: all.length - 1 }[e.key];
      if (next === undefined) return;
      e.preventDefault();
      const target = all[(next + all.length) % all.length];
      target.focus();
      show(target.dataset.tab);
    });
  });
  show(start);
}
