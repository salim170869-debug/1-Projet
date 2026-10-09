import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export type Unit = { id: number; name: string; address: string; capacity: number; nightlyRate: number; notes: string };
export type Guest = { id: number; name: string; email: string; phone: string; notes: string };
export type Booking = { id: number; unitId: number; guestId: number; arrival: string; departure: string; amount: number; status: string; notes: string };
export type Cleaning = { id: number; unitId: number; bookingId: number | null; date: string; assignee: string; status: string };
export type Payment = { id: number; bookingId: number; date: string; amount: number; method: string };
export type Data = { units: Unit[]; guests: Guest[]; bookings: Booking[]; cleanings: Cleaning[]; payments: Payment[] };

export class UserError extends Error {}
function fail(message: string): never { throw new UserError(message); }
function string(v: unknown, label: string, required = true): string {
  if (typeof v !== 'string') fail(`${label} doit être un texte.`);
  const s = v.trim();
  if (required && !s) fail(`${label} est obligatoire.`);
  if (s.length > 2000) fail(`${label} est trop long.`);
  return s;
}
function integer(v: unknown, label: string, min = 1): number {
  if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < min || v > 100000000) fail(`${label} est invalide.`);
  return v;
}
function date(v: unknown): string {
  const s = string(v, 'La date');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s)) || new Date(s).toISOString().slice(0, 10) !== s) fail('La date est invalide.');
  return s;
}
function choice(v: unknown, choices: string[]): string { const s = string(v, 'Le statut'); if (!choices.includes(s)) fail('La valeur sélectionnée est invalide.'); return s; }

export function createStore(path: string) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS units(id INTEGER PRIMARY KEY, name TEXT NOT NULL, address TEXT NOT NULL, capacity INTEGER NOT NULL, nightlyRate INTEGER NOT NULL, notes TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS guests(id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT NOT NULL, notes TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS bookings(id INTEGER PRIMARY KEY, unitId INTEGER NOT NULL REFERENCES units(id), guestId INTEGER NOT NULL REFERENCES guests(id), arrival TEXT NOT NULL, departure TEXT NOT NULL, amount INTEGER NOT NULL, status TEXT NOT NULL, notes TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS cleanings(id INTEGER PRIMARY KEY, unitId INTEGER NOT NULL REFERENCES units(id), bookingId INTEGER UNIQUE REFERENCES bookings(id), date TEXT NOT NULL, assignee TEXT NOT NULL, status TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS payments(id INTEGER PRIMARY KEY, bookingId INTEGER NOT NULL REFERENCES bookings(id), date TEXT NOT NULL, amount INTEGER NOT NULL, method TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS bookings_dates ON bookings(unitId, arrival, departure);`);
  const all = <T>(table: string): T[] => db.prepare(`SELECT * FROM ${table} ORDER BY id DESC`).all() as T[];
  function snapshot(): Data { return { units: all<Unit>('units'), guests: all<Guest>('guests'), bookings: all<Booking>('bookings'), cleanings: all<Cleaning>('cleanings'), payments: all<Payment>('payments') }; }
  function exists(table: string, id: number) { if (!db.prepare(`SELECT id FROM ${table} WHERE id=?`).get(id)) fail('Cet élément n’existe plus.'); }
  function mutate(action: string, input: Record<string, unknown>) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const id = input.id == null ? null : integer(input.id, 'L’identifiant');
      switch (action) {
        case 'unit': {
          const args = [string(input.name, 'Le nom'), string(input.address, 'L’adresse'), integer(input.capacity, 'La capacité'), integer(input.nightlyRate, 'Le tarif', 0), string(input.notes ?? '', 'Les notes', false)];
          if (id) { exists('units', id); db.prepare('UPDATE units SET name=?,address=?,capacity=?,nightlyRate=?,notes=? WHERE id=?').run(...args, id); }
          else db.prepare('INSERT INTO units(name,address,capacity,nightlyRate,notes) VALUES(?,?,?,?,?)').run(...args);
          break;
        }
        case 'guest': {
          const email = string(input.email ?? '', 'L’email', false);
          if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('L’adresse email est invalide.');
          const args = [string(input.name, 'Le nom'), email, string(input.phone ?? '', 'Le téléphone', false), string(input.notes ?? '', 'Les notes', false)];
          if (id) { exists('guests', id); db.prepare('UPDATE guests SET name=?,email=?,phone=?,notes=? WHERE id=?').run(...args,id); }
          else db.prepare('INSERT INTO guests(name,email,phone,notes) VALUES(?,?,?,?)').run(...args);
          break;
        }
        case 'booking': {
          const unitId = integer(input.unitId, 'Le logement'), guestId = integer(input.guestId, 'Le voyageur');
          exists('units', unitId); exists('guests', guestId); if (id) exists('bookings', id);
          const arrival = date(input.arrival), departure = date(input.departure);
          if (departure <= arrival) fail('Le départ doit être après l’arrivée.');
          const amount = integer(input.amount, 'Le montant', 0), status = choice(input.status, ['confirmed','pending','cancelled']);
          if (status !== 'cancelled' && db.prepare("SELECT id FROM bookings WHERE unitId=? AND status!='cancelled' AND arrival<? AND departure>? AND id!=?").get(unitId,departure,arrival,id ?? 0)) fail('Ce logement est déjà réservé sur ces dates.');
          const paid = id ? Number(db.prepare('SELECT COALESCE(SUM(amount),0) AS total FROM payments WHERE bookingId=?').get(id)?.total ?? 0) : 0;
          if (paid > amount) fail('Le montant ne peut pas être inférieur aux paiements reçus.');
          if (status === 'cancelled' && paid > 0) fail('Supprimez les paiements remboursés avant d’annuler la réservation.');
          const args = [unitId,guestId,arrival,departure,amount,status,string(input.notes ?? '', 'Les notes', false)];
          let bookingId = id;
          if (id) db.prepare('UPDATE bookings SET unitId=?,guestId=?,arrival=?,departure=?,amount=?,status=?,notes=? WHERE id=?').run(...args,id);
          else bookingId = Number(db.prepare('INSERT INTO bookings(unitId,guestId,arrival,departure,amount,status,notes) VALUES(?,?,?,?,?,?,?)').run(...args).lastInsertRowid);
          if (status === 'cancelled') db.prepare('DELETE FROM cleanings WHERE bookingId=?').run(bookingId!);
          else db.prepare("INSERT INTO cleanings(unitId,bookingId,date,assignee,status) VALUES(?,?,?,'','todo') ON CONFLICT(bookingId) DO UPDATE SET unitId=excluded.unitId,date=excluded.date").run(unitId,bookingId!,departure);
          break;
        }
        case 'cleaning': {
          const unitId = integer(input.unitId,'Le logement'); exists('units',unitId);
          const day = date(input.date), assignee = string(input.assignee ?? '', 'La personne responsable', false), status = choice(input.status,['todo','progress','done']);
          if (id) {
            exists('cleanings',id);
            const linked = db.prepare('SELECT bookingId,unitId FROM cleanings WHERE id=?').get(id);
            if (linked?.bookingId && linked.unitId !== unitId) fail('Le logement doit correspondre à la réservation.');
            db.prepare('UPDATE cleanings SET unitId=?,date=?,assignee=?,status=? WHERE id=?').run(unitId,day,assignee,status,id);
          } else db.prepare('INSERT INTO cleanings(unitId,bookingId,date,assignee,status) VALUES(?,NULL,?,?,?)').run(unitId,day,assignee,status);
          break;
        }
        case 'payment': {
          const bookingId = integer(input.bookingId, 'La réservation'); exists('bookings',bookingId);
          const booking = db.prepare('SELECT amount,status FROM bookings WHERE id=?').get(bookingId)!;
          if (booking.status === 'cancelled') fail('Cette réservation est annulée.');
          const amount = integer(input.amount,'Le paiement');
          const paid = Number(db.prepare('SELECT COALESCE(SUM(amount),0) AS total FROM payments WHERE bookingId=?').get(bookingId)?.total ?? 0);
          if (paid + amount > Number(booking.amount)) fail('Le paiement dépasse le solde de la réservation.');
          db.prepare('INSERT INTO payments(bookingId,date,amount,method) VALUES(?,?,?,?)').run(bookingId,date(input.date),amount,choice(input.method,['transfer','card','cash','other']));
          break;
        }
        case 'delete': {
          const table = choice(input.entity,['units','guests','bookings','cleanings','payments']);
          if (!id) fail('L’identifiant est obligatoire.'); exists(table,id);
          if (table === 'bookings') {
            if (db.prepare('SELECT id FROM payments WHERE bookingId=?').get(id)) fail('Supprimez d’abord les paiements de cette réservation.');
            db.prepare('DELETE FROM cleanings WHERE bookingId=?').run(id);
          }
          if (table === 'units' && (db.prepare('SELECT id FROM bookings WHERE unitId=?').get(id) || db.prepare('SELECT id FROM cleanings WHERE unitId=?').get(id))) fail('Ce logement est utilisé par une réservation ou un ménage.');
          if (table === 'guests' && db.prepare('SELECT id FROM bookings WHERE guestId=?').get(id)) fail('Ce voyageur possède des réservations.');
          db.prepare(`DELETE FROM ${table} WHERE id=?`).run(id); break;
        }
        default: fail('Action inconnue.');
      }
      db.exec('COMMIT'); return snapshot();
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  return { snapshot, mutate, close: () => db.close() };
}
