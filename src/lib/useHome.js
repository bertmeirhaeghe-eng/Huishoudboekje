// Gedeelde gegevens voor het huishouden: boodschappen, voorraad, recepten en weekmenu.
// Wijzigingen verschijnen meteen op het scherm en worden daarna bewaard.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { store } from './store.js';
import { findInPantry, sameThing, slotOf } from './kitchen.js';

const TABLES = ['shopping_items', 'pantry_items', 'recipes', 'menu_days'];
const EMPTY = { shopping: [], pantry: [], recipes: [], menu: [] };

export function useHome(hid) {
  const [data, setData] = useState(EMPTY);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const dataRef = useRef(data);
  dataRef.current = data;

  const load = useCallback(async () => {
    try {
      const [shopping, pantry, recipes, menu] = await Promise.all(TABLES.map((t) => store.listRows(t, hid)));
      setData({
        shopping: shopping.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at))),
        pantry: pantry.sort((a, b) => a.name.localeCompare(b.name, 'nl')),
        recipes: recipes.sort((a, b) => a.title.localeCompare(b.title, 'nl')),
        menu,
      });
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

    return {
      reload: load,
      addShopping,

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
  }, [hid, load, run]);

  return { ...data, ready, error, act };
}
