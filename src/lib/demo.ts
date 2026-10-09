import type { createStore } from './store.ts';

/** Prépare des exemples uniquement dans une base vide ; préserve toute donnée existante. */
export function seedDemo(store: ReturnType<typeof createStore>, reference = new Date()) {
  if (Object.values(store.snapshot()).some(rows => rows.length > 0)) return false;
  const date = (offset: number) => {
    const d = new Date(reference); d.setUTCHours(12, 0, 0, 0); d.setUTCDate(d.getUTCDate() + offset);
    return d.toISOString().slice(0, 10);
  };
  const units = [
    { name: 'Maison des Oliviers', address: 'Adresse fictive · Aix-en-Provence', capacity: 4, nightlyRate: 14000, notes: 'Exemple : terrasse ombragée, deux chambres et parking.' },
    { name: 'Studio du Port', address: 'Adresse fictive · La Rochelle', capacity: 2, nightlyRate: 12000, notes: 'Exemple : studio pour deux personnes, à proximité du port.' },
    { name: 'Villa des Dunes', address: 'Adresse fictive · Arcachon', capacity: 6, nightlyRate: 18000, notes: 'Exemple : trois chambres, jardin et espace de détente.' },
  ];
  for (const unit of units) store.mutate('unit', unit);
  for (const [index, name] of ['Camille Martin', 'Alex Dubois', 'Lou Bernard', 'Charlie Petit', 'Dominique Moreau', 'Noa Laurent'].entries()) {
    store.mutate('guest', { name, email: `voyageur${index + 1}@example.invalid`, phone: '', notes: 'Personnage fictif pour la démonstration.' });
  }
  const bookings = [
    { unitId: 2, guestId: 1, arrival: date(-10), departure: date(-7), amount: 36000, status: 'confirmed' },
    { unitId: 1, guestId: 2, arrival: date(-2), departure: date(2), amount: 56000, status: 'confirmed' },
    { unitId: 3, guestId: 3, arrival: date(3), departure: date(7), amount: 72000, status: 'confirmed' },
    { unitId: 2, guestId: 4, arrival: date(1), departure: date(4), amount: 39000, status: 'confirmed' },
    { unitId: 1, guestId: 5, arrival: date(9), departure: date(11), amount: 28000, status: 'pending' },
    { unitId: 3, guestId: 6, arrival: date(8), departure: date(9), amount: 18000, status: 'cancelled' },
  ];
  for (const booking of bookings) store.mutate('booking', { ...booking, notes: 'Séjour fictif de démonstration.' });
  for (const cleaning of store.snapshot().cleanings) {
    store.mutate('cleaning', { ...cleaning, assignee: cleaning.unitId === 3 ? 'Équipe des Dunes (exemple)' : 'Sophie (exemple)', status: cleaning.date < date(0) ? 'done' : 'todo' });
  }
  for (const payment of [
    { bookingId: 1, date: date(-11), amount: 36000, method: 'transfer' },
    { bookingId: 2, date: date(-5), amount: 28000, method: 'card' },
    { bookingId: 3, date: date(-1), amount: 21600, method: 'transfer' },
  ]) store.mutate('payment', payment);
  return true;
}
