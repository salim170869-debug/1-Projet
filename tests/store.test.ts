import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore } from '../src/lib/store.ts';

function setup() {
  const store = createStore(':memory:');
  store.mutate('unit',{name:'Maison des Oliviers',address:'12 rue du Port, La Rochelle',capacity:4,nightlyRate:12500});
  store.mutate('guest',{name:'Camille Martin',email:'camille@example.fr',phone:'0612345678'});
  const booking = {unitId:1,guestId:1,arrival:'2026-11-10',departure:'2026-11-14',amount:50000,status:'confirmed'};
  return {store,booking};
}
test('Une réservation relie le voyageur au logement et planifie le ménage au départ',()=>{
  const {store,booking}=setup();const data=store.mutate('booking',booking);
  assert.equal(data.bookings.length,1);assert.equal(data.bookings[0].guestId,1);
  assert.deepEqual({...data.cleanings[0]},{id:1,unitId:1,bookingId:1,date:'2026-11-14',assignee:'',status:'todo'});store.close();
});
test('Les dates qui se chevauchent sont bloquées, y compris les séjours à confirmer',()=>{
  const {store,booking}=setup();store.mutate('booking',booking);
  for (const [arrival,departure] of [['2026-11-09','2026-11-11'],['2026-11-13','2026-11-16'],['2026-11-11','2026-11-13'],['2026-11-09','2026-11-16']]) assert.throws(()=>store.mutate('booking',{...booking,arrival,departure,status:'pending'}),/déjà réservé/);
  assert.equal(store.snapshot().bookings.length,1);assert.equal(store.snapshot().cleanings.length,1);store.close();
});
test('Un nouveau voyageur peut arriver le jour du départ précédent',()=>{
  const {store,booking}=setup();store.mutate('booking',booking);assert.equal(store.mutate('booking',{...booking,arrival:booking.departure,departure:'2026-11-18'}).bookings.length,2);store.close();
});
test('Déplacer une réservation actualise le ménage et préserve son responsable',()=>{
  const {store,booking}=setup();store.mutate('booking',booking);store.mutate('cleaning',{id:1,unitId:1,date:booking.departure,assignee:'Sophie',status:'progress'});
  const data=store.mutate('booking',{...booking,id:1,departure:'2026-11-15'});
  assert.equal(data.cleanings.length,1);assert.equal(data.cleanings[0].date,'2026-11-15');assert.equal(data.cleanings[0].assignee,'Sophie');store.close();
});
test('Une annulation libère les dates et supprime le ménage lié',()=>{
  const {store,booking}=setup();store.mutate('booking',booking);assert.equal(store.mutate('booking',{...booking,id:1,status:'cancelled'}).cleanings.length,0);
  assert.equal(store.mutate('booking',booking).bookings.length,2);store.close();
});
test('Les paiements en centimes sont conservés et ne peuvent dépasser le solde',()=>{
  const {store,booking}=setup();store.mutate('booking',booking);
  store.mutate('payment',{bookingId:1,date:'2026-11-01',amount:20000,method:'transfer'});
  assert.throws(()=>store.mutate('payment',{bookingId:1,date:'2026-11-02',amount:30001,method:'cash'}),/dépasse le solde/);
  store.mutate('payment',{bookingId:1,date:'2026-11-02',amount:30000,method:'cash'});
  assert.equal(store.snapshot().payments.reduce((s,p)=>s+p.amount,0),50000);store.close();
});
test('Une réservation payée ne peut être annulée ni réduite sous les paiements',()=>{
  const {store,booking}=setup();store.mutate('booking',booking);store.mutate('payment',{bookingId:1,date:'2026-11-01',amount:20000,method:'card'});
  assert.throws(()=>store.mutate('booking',{...booking,id:1,status:'cancelled'}),/paiements remboursés/);
  assert.throws(()=>store.mutate('booking',{...booking,id:1,amount:19999}),/inférieur aux paiements/);assert.equal(store.snapshot().bookings[0].amount,50000);store.close();
});
test('Les éléments utilisés ne peuvent être supprimés par accident',()=>{
  const {store,booking}=setup();store.mutate('booking',booking);
  assert.throws(()=>store.mutate('delete',{entity:'units',id:1}),/utilisé/);
  assert.throws(()=>store.mutate('delete',{entity:'guests',id:1}),/réservations/);
  store.mutate('payment',{bookingId:1,date:'2026-11-01',amount:10000,method:'transfer'});
  assert.throws(()=>store.mutate('delete',{entity:'bookings',id:1}),/paiements/);
  store.mutate('delete',{entity:'payments',id:1});store.mutate('delete',{entity:'bookings',id:1});assert.equal(store.snapshot().cleanings.length,0);store.close();
});
test('Les dates, montants, emails et références invalides sont refusés',()=>{
  const {store,booking}=setup();
  assert.throws(()=>store.mutate('booking',{...booking,arrival:'2026-02-30'}),/date est invalide/);
  assert.throws(()=>store.mutate('booking',{...booking,departure:booking.arrival}),/départ doit être après/);
  assert.throws(()=>store.mutate('booking',{...booking,amount:-1}),/montant est invalide/);
  assert.throws(()=>store.mutate('booking',{...booking,amount:1.5}),/montant est invalide/);
  assert.throws(()=>store.mutate('booking',{...booking,unitId:99}),/n’existe plus/);
  assert.throws(()=>store.mutate('guest',{name:'Test',email:'invalide'}),/email est invalide/);
  assert.equal(store.snapshot().bookings.length,0);store.close();
});
test('Une réservation annulée ne reçoit aucun paiement',()=>{
  const {store,booking}=setup();store.mutate('booking',{...booking,status:'cancelled'});
  assert.throws(()=>store.mutate('payment',{bookingId:1,date:'2026-11-01',amount:100,method:'other'}),/annulée/);store.close();
});
test('Les données survivent à la fermeture et à la réouverture de la base',()=>{
  const directory=mkdtempSync(join(tmpdir(),'sejour-test-'));
  try {const path=join(directory,'test.sqlite');let store=createStore(path);store.mutate('guest',{name:'Voyageur persistant'});store.close();store=createStore(path);assert.equal(store.snapshot().guests[0].name,'Voyageur persistant');store.close();} finally {rmSync(directory,{recursive:true,force:true});}
});
test('Réactiver une réservation annulée recrée son ménage',()=>{
  const {store,booking}=setup();store.mutate('booking',{...booking,status:'cancelled'});
  const data=store.mutate('booking',{...booking,id:1,status:'confirmed'});
  assert.equal(data.cleanings.length,1);assert.equal(data.cleanings[0].bookingId,1);store.close();
});
