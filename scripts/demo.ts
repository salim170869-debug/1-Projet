import { resolve } from 'node:path';
import { createStore } from '../src/lib/store.ts';
import { seedDemo } from '../src/lib/demo.ts';
const store = createStore(resolve('data/demo.sqlite'));
try { console.log(seedDemo(store) ? 'Démonstration créée : 3 logements, 6 voyageurs, 6 réservations et 3 paiements fictifs.' : 'Démonstration existante conservée.'); }
finally { store.close(); }
