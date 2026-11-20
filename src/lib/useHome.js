// Gedeelde gegevens voor het huishouden: boodschappen, voorraad, recepten en weekmenu.
// Wijzigingen verschijnen meteen op het scherm en worden daarna bewaard.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { store } from './store.js';
import { findInPantry, sameThing, slotOf } from './kitchen.js';
import { needsAgenda } from './chores.js';

const TABLES = ['shopping_items', 'pantry_items', 'recipes', 'menu_days'];
const EMPTY = { shopping: [], pantry: [], recipes: [], menu: [], chores: [] };

export function useHome(hid) {
  const [data, setData] = useState(EMPTY);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const dataRef = useRef(data);
  dataRef.current = data;

  // Klusjes apart: ontbreekt die tabel nog (schema.sql niet opnieuw uitgevoerd), dan werkt de rest gewoon.
  const [choresError, setChoresError] = useState('');
  const [agenda, setAgenda] = useState(null); // { ready, linked, calendar, owner } van de klusjes-agenda
  const [agendaError, setAgendaError] = useState('');
  const loadChores = useCallback(async () => {
    try {
      const chores = await store.listChores(hid);
      setData((d) => ({ ...d, chores }));
      setChoresError('');
    } catch (e) {
      setChoresError(e.message);
    }
  }, [hid]);
  useEffect(() => { loadChores(); }, [loadChores]);
  useEffect(() => store.subscribe(hid, loadChores, ['chores']), [hid, loadChores]);

  // De agenda bijwerken gebeurt op de achtergrond: lukt het niet, dan blijft het klusje gewoon bewaard
  // en proberen we het later opnieuw (het staat dan nog op "gcal_dirty").
  const syncAgenda = useCallback(async (ids) => {
    try {
      const r = await store.choresAgenda('sync', ids ? { ids } : {});
      if (r) setAgenda((a) => ({ ...a, ready: r.ready, linked: r.linked, calendar: r.calendar, owner: r.owner, demo: r.demo }));
      setAgendaError(r?.failed?.length ? `Dit kon niet in de agenda: ${r.failed.join(', ')}. Ik probeer het later opnieuw.` : '');
      if (r?.synced) await loadChores();
      return r;
    } catch (e) {
      if (e.code === 'niet-ingesteld') setAgenda((a) => ({ ...(a || {}), ready: false, linked: false, missing: e.message }));
      else if (e.code === 'verlopen') { setAgenda((a) => ({ ...(a || {}), linked: false, expired: true })); setAgendaError(e.message); }
      else setAgendaError(e.message);
      return null;
    }
  }, [loadChores]);

  const load = useCallback(async () => {
    try {
      const [shopping, pantry, recipes, menu] = await Promise.all(TABLES.map((t) => store.listRows(t, hid)));
      setData((d) => ({
        ...d,
        shopping: shopping.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at))),
        pantry: pantry.sort((a, b) => a.name.localeCompare(b.name, 'nl')),
        recipes: recipes.sort((a, b) => a.title.localeCompare(b.title, 'nl')),
        menu,
      }));
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setReady(true);
    }
  }, [hid]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => store.subscribe(hid, load, TABLES), [hid, load]);

  // Eerst op het scherm, dan bewaren. Lukt bewaren niet, dan laden we opnieuw.
  const run = useCallback(async (local, remote) => {
    if (local) setData((d) => ({ ...d, ...local(d) }));
    try {
      const out = await remote();
      await load();
      return out;
    } catch (e) {
      setError(e.message);
      await load();
      throw e;
    }
  }, [load]);

  // Zoals run(), maar voor de klusjes.
  const runChores = useCallback(async (local, remote) => {
    if (local) setData((d) => ({ ...d, chores: local(d.chores) }));
    try {
      const out = await remote();
      await loadChores();
      return out;
    } catch (e) {
      await loadChores();
      throw e;
    }
  }, [loadChores]);

  const act = useMemo(() => {
    const addShopping = (items, source = null) => {
      const open = dataRef.current.shopping.filter((s) => !s.done);
      const fresh = [];
      for (const it of items) {
        const name = String(it.name || '').trim().slice(0, 80);
        if (!name) continue;
        if (open.some((s) => sameThing(s.name, name)) || fresh.some((s) => sameThing(s.name, name))) continue;
        fresh.push({ household_id: hid, name: name.charAt(0).toUpperCase() + name.slice(1), qty: it.qty ? String(it.qty).slice(0, 40) : null, source: (it.source || source) ? String(it.source || source).slice(0, 120) : null, done: false });
      }
      if (!fresh.length) return Promise.resolve(0);
      return run((d) => ({ shopping: [...d.shopping, ...fresh.map((f, i) => ({ ...f, id: 'tmp' + i + Date.now(), created_at: new Date().toISOString() }))] }), () => store.addRows('shopping_items', fresh)).then(() => fresh.length);
    };

    const chore = (id) => dataRef.current.chores.find((c) => c.id === id);
    const updateChore = async (id, patch) => {
      const before = chore(id);
      const p = { ...patch };
      if ('planned_date' in p && !p.planned_date) { p.planned_date = null; p.planned_time = null; }
      if ('done' in p) p.done_at = p.done ? new Date().toISOString() : null;
      const agendaToo = needsAgenda(before, p);
      if (agendaToo) p.gcal_dirty = true;
      const { photo, ...shown } = p;
      await runChores((list) => list.map((c) => (c.id === id ? { ...c, ...shown } : c)), () => store.updateRow('chores', id, p));
      if (agendaToo) syncAgenda([id]);
    };

    return {
      reload: load,
      addShopping,

      // ── Klusjes ──
      syncAgenda,
      async agendaStatus() {
        try {
          const r = await store.choresAgenda('status');
          setAgenda(r);
          return r;
        } catch (e) {
          const r = { ready: false, linked: false, missing: e.code === 'niet-ingesteld' ? e.message : '' };
          setAgenda(r);
          if (e.code !== 'niet-ingesteld') setAgendaError(e.message);
          return r;
        }
      },
      setAgenda,

      async addChore({ title, note = null, thumb = null, photo = null, planned_date = null, planned_time = null }) {
        const t = String(title || '').trim().slice(0, 120);
        if (!t) return null;
        const row = {
          household_id: hid,
          title: t.charAt(0).toUpperCase() + t.slice(1),
          note: note ? String(note).trim().slice(0, 1000) || null : null,
          thumb, photo,
          planned_date: planned_date || null,
          planned_time: planned_date && planned_time ? planned_time : null,
          done: false,
          gcal_dirty: Boolean(planned_date),
        };
        const tmp = { ...row, photo: undefined, id: 'tmp' + Date.now(), created_at: new Date().toISOString() };
        const [made] = await runChores((list) => [...list, tmp], () => store.addRows('chores', [row]));
        if (made && row.planned_date) syncAgenda([made.id]);
        return made;
      },

      updateChore,
      toggleChore: (c) => updateChore(c.id, { done: !c.done }),

      // Weg uit de lijst. Stond het in de agenda (en is het nog niet gedaan), dan ook weg uit de agenda.
      async deleteChore(id, { keepEvent = false } = {}) {
        const c = chore(id);
        await runChores((list) => list.filter((x) => x.id !== id), async () => {
          if (c?.gcal_event_id && store.mode !== 'demo') {
            try { await store.choresAgenda('remove', { id, keepEvent }); return; } catch (e) {
              if (e.code !== 'niet-ingesteld' && e.code !== 'niet-gekoppeld' && e.code !== 'verlopen') throw e;
            }
          }
          await store.deleteRows('chores', [id]);
        });
      },

      // Wat gedaan is, mag weg. In de agenda blijft het staan (met een vinkje), als herinnering.
      clearDoneChores() {
        const ids = dataRef.current.chores.filter((c) => c.done).map((c) => c.id);
        return runChores((list) => list.filter((c) => !c.done), () => store.deleteRows('chores', ids));
      },

      chorePhoto: (id) => store.chorePhoto(id),

      async toggleShopping(item) {
        const done = !item.done;
        const p = findInPantry(item.name, dataRef.current.pantry);
        await run(
          (d) => ({
            shopping: d.shopping.map((s) => (s.id === item.id ? { ...s, done } : s)),
            pantry: done && p ? d.pantry.map((x) => (x.id === p.id ? { ...x, status: 'ok' } : x)) : d.pantry,
          }),
          async () => {
            await store.updateRow('shopping_items', item.id, { done });
            // Gekocht? Dan is het weer in voorraad.
            if (done && p && p.status !== 'ok') await store.updateRow('pantry_items', p.id, { status: 'ok', updated_at: new Date().toISOString() });
          },
        );
        return done && p && p.status !== 'ok' ? p : null;
      },

      clearDone() {
        const ids = dataRef.current.shopping.filter((s) => s.done).map((s) => s.id);
        return run((d) => ({ shopping: d.shopping.filter((s) => !s.done) }), () => store.deleteRows('shopping_items', ids));
      },

      deleteShopping(id) {
        return run((d) => ({ shopping: d.shopping.filter((s) => s.id !== id) }), () => store.deleteRows('shopping_items', [id]));
      },

      addPantry(items) {
        const have = dataRef.current.pantry;
        const fresh = items
          .map((i) => ({ household_id: hid, name: String(i.name).trim().slice(0, 80), place: i.place || 'kast', status: i.status || 'ok' }))
          .filter((i) => i.name && !have.some((p) => sameThing(p.name, i.name)))
          .map((i) => ({ ...i, name: i.name.charAt(0).toUpperCase() + i.name.slice(1) }));
        if (!fresh.length) return Promise.resolve(0);
        return run((d) => ({ pantry: [...d.pantry, ...fresh.map((f, i) => ({ ...f, id: 'tmp' + i + Date.now() }))] }), () => store.addRows('pantry_items', fresh)).then(() => fresh.length);
      },

      // Op of bijna op? Dan zetten we het meteen op de boodschappenlijst.
      async setPantryStatus(item, status) {
        await run((d) => ({ pantry: d.pantry.map((p) => (p.id === item.id ? { ...p, status } : p)) }), () => store.updateRow('pantry_items', item.id, { status, updated_at: new Date().toISOString() }));
        if (status !== 'ok') return addShopping([{ name: item.name }], 'Voorraad');
        return 0;
      },

      // Vanuit spraak: "de melk is op". Bestaat het nog niet in de voorraad, dan voegen we het toe.
      async markOut(items, status = 'op') {
        let added = 0;
        for (const it of items) {
          const p = findInPantry(it.name, dataRef.current.pantry);
          if (p) await run(null, () => store.updateRow('pantry_items', p.id, { status, updated_at: new Date().toISOString() }));
          else await run(null, () => store.addRows('pantry_items', [{ household_id: hid, name: it.name.charAt(0).toUpperCase() + it.name.slice(1), place: 'kast', status }]));
        }
        added = await addShopping(items, 'Voorraad');
        return added;
      },

      // Van een foto: nieuwe producten erbij, bestaande op "genoeg" of "bijna op" zetten.
      // Wat bijna op is, komt ook op de boodschappenlijst.
      async applyPhotoScan(rows) {
        const now = new Date().toISOString();
        const fresh = rows.filter((r) => !r.existing);
        const added = fresh.length ? await this.addPantry(fresh.map((r) => ({ name: r.name, place: r.place, status: r.status }))) : 0;
        let updated = 0;
        for (const r of rows.filter((x) => x.existing)) {
          const patch = {};
          if (r.existing.status !== r.status) patch.status = r.status;
          if (r.existing.place !== r.place) patch.place = r.place;
          if (r.existing.name !== r.name && r.name.trim()) patch.name = r.name.trim().slice(0, 80);
          if (!Object.keys(patch).length) continue;
          await run((d) => ({ pantry: d.pantry.map((p) => (p.id === r.existing.id ? { ...p, ...patch } : p)) }), () => store.updateRow('pantry_items', r.existing.id, { ...patch, updated_at: now }));
          updated++;
        }
        const low = rows.filter((r) => r.status === 'bijna');
        const listed = low.length ? await addShopping(low.map((r) => ({ name: r.name })), 'Voorraad') : 0;
        return { added, updated, listed };
      },

      updatePantry(id, patch) {
        return run((d) => ({ pantry: d.pantry.map((p) => (p.id === id ? { ...p, ...patch } : p)) }), () => store.updateRow('pantry_items', id, patch));
      },

      deletePantry(id) {
        return run((d) => ({ pantry: d.pantry.filter((p) => p.id !== id) }), () => store.deleteRows('pantry_items', [id]));
      },

      async saveRecipe(r) {
        const row = {
          title: r.title.trim().slice(0, 120),
          servings: r.servings ? Math.max(1, Math.min(99, Number(r.servings))) : null,
          ingredients: (r.ingredients || []).filter((i) => i.name).map(({ qty, name, note }) => ({ qty: qty || null, name, note: note || null })),
          steps: r.steps ? r.steps.slice(0, 20000) : null,
          photo: r.photo || null,
        };
        if (r.id) return run(null, () => store.updateRow('recipes', r.id, row));
        const [made] = await run(null, () => store.addRows('recipes', [{ ...row, household_id: hid }]));
        return made;
      },

      deleteRecipe(id) {
        return run(
          (d) => ({ recipes: d.recipes.filter((r) => r.id !== id), menu: d.menu.map((m) => (m.recipe_id === id ? { ...m, recipe_id: null } : m)) }),
          async () => {
            // In de proefmodus is er geen database die dit voor ons doet.
            if (store.mode === 'demo') for (const m of dataRef.current.menu.filter((x) => x.recipe_id === id)) await store.setMenu(hid, m.date, m.meal, null, slotOf(m));
            await store.deleteRows('recipes', [id]);
          },
        );
      },

      setMenu(date, meal, recipeId = null, slot = 'avond') {
        const m = (meal || '').trim().slice(0, 120);
        return run(
          (d) => ({ menu: [...d.menu.filter((x) => !(x.date === date && slotOf(x) === slot)), ...(m ? [{ household_id: hid, date, slot, meal: m, recipe_id: recipeId }] : [])] }),
          () => store.setMenu(hid, date, m, recipeId, slot),
        );
      },
    };
  }, [hid, load, run, runChores, syncAgenda]);

  return { ...data, ready, error, choresError, agenda, agendaError, setAgendaError, act };
}
