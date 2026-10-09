import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../src/lib/store.ts';
import { seedDemo } from '../src/lib/demo.ts';
test('La démonstration comporte des séjours variés, des ménages et des encaissements cohérents',()=>{
  const store=createStore(':memory:');
  try {
    assert.equal(seedDemo(store,new Date('2026-10-09T12:00:00Z')),true);
    const data=store.snapshot();
    assert.equal(data.units.length,3);assert.equal(data.guests.length,6);assert.equal(data.bookings.length,6);assert.equal(data.cleanings.length,5);
    assert.equal(data.payments.reduce((total,p)=>total+p.amount,0),85600);
    assert.ok(data.bookings.some(b=>b.arrival<'2026-10-09' && b.departure>'2026-10-09'));
    assert.ok(data.bookings.some(b=>b.status==='cancelled'));assert.ok(data.bookings.some(b=>b.status==='pending'));
    assert.ok(data.guests.every(g=>g.email.endsWith('@example.invalid')));
    assert.equal(seedDemo(store,new Date('2026-11-01')),false);assert.deepEqual(store.snapshot(),data);
  } finally {store.close();}
});
test('La préparation des exemples préserve une base contenant des données utilisateur',()=>{
  const store=createStore(':memory:');
  try {store.mutate('guest',{name:'Utilisateur existant'});const before=store.snapshot();assert.equal(seedDemo(store),false);assert.deepEqual(store.snapshot(),before);}finally{store.close();}
});
