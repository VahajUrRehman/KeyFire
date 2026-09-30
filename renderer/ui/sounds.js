// Sounds tab: the list of sounds (preview, choose, remove), the Add menu and drag-and-drop import.
import { sk, engine, S, PACKS, app, loaded, $, el, note, ICON, replace, on, render, emit } from './core.js';
import { getPack, usePack, touch } from './library.js';

function renderPacks() {
  const list = $('#packs');
  list.replaceChildren();
  PACKS.forEach((p) => {
    const row = el('div', 'pack');
    row.setAttribute('role', 'radio');
    row.setAttribute('aria-checked', p.id === S.pack);
    row.tabIndex = 0;

    const text = el('div');
    text.append(el('div', 'name', p.name), el('div', 'meta', p.meta));

    const play = el('button', 'icon');
    play.innerHTML = ICON.play;
    play.setAttribute('aria-label', 'Preview ' + p.name);
    play.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        const lp = await getPack(p.id);
        engine.pitchJitter = lp.jitter;
        engine.play(lp.sample(), 30);
        if (app.pack) engine.pitchJitter = app.pack.jitter;
      } catch (err) { note(`Couldn't play that sound: ${err.message}.`, true); }
    });
    row.append(el('span', 'dot'), text, play);

    if (p.removable) {
      const del = el('button', 'icon');
      del.innerHTML = ICON.trash;
      del.setAttribute('aria-label', 'Remove ' + p.name);
      let armed = 0;
      del.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!armed) {
          del.classList.add('armed');
          del.textContent = 'Remove?';
          armed = setTimeout(() => { del.classList.remove('armed'); del.innerHTML = ICON.trash; armed = 0; }, 3000);
          return;
        }
        clearTimeout(armed);
        const r = await sk.removePack(p.id);
        replace(PACKS, r.packs);
        loaded.delete(p.id);
        if (S.pack === p.id) { await usePack('synth'); sk.patch({ pack: S.pack }); touch(); }
        render();
        note(r.note || 'Removed.', !r.ok);
      });
      row.append(del);
    } else {
      row.append(el('span', 'gap'));
    }

    const choose = async () => {
      await usePack(p.id);
      sk.patch({ pack: S.pack });
      touch();
      renderPacks();
    };
    row.addEventListener('click', choose);
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(); }
    });
    list.append(row);
  });
}

export function initSounds() {
  // Add menu
  const menu = $('#menu');
  const addBtn = $('#addBtn');
  const closeMenu = () => { menu.hidden = true; addBtn.setAttribute('aria-expanded', 'false'); };
  addBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.hidden = !menu.hidden;
    addBtn.setAttribute('aria-expanded', String(!menu.hidden));
  });
  document.addEventListener('click', closeMenu);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
  menu.querySelectorAll('button').forEach((b) => b.addEventListener('click', async () => {
    closeMenu();
    const r = await sk.addPack(b.dataset.kind);
    replace(PACKS, r.packs);
    loaded.delete('files');
    if (r.select) { await usePack(r.select); sk.patch({ pack: S.pack }); touch(); }
    render();
    if (r.note) note(r.note, !r.ok);
  }));

  // drag and drop keyboard packs (folders or .zip)
  const dropHint = $('#dropHint');
  let depth = 0;
  window.addEventListener('dragenter', (e) => { e.preventDefault(); depth++; dropHint.hidden = false; });
  window.addEventListener('dragleave', () => { if (--depth <= 0) { depth = 0; dropHint.hidden = true; } });
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', async (e) => {
    e.preventDefault();
    depth = 0; dropHint.hidden = true;
    if (!e.dataTransfer.files.length) return;
    const r = await sk.dropPacks(e.dataTransfer.files);
    replace(PACKS, r.packs);
    if (r.select) await usePack(r.select);
    render();
    if (r.note) note(r.note, !r.ok);
  });

  on('render', renderPacks);
}
