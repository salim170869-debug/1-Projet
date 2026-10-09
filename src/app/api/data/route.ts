import { createStore, UserError } from '@/lib/store';
import { resolve } from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const globalStore = globalThis as unknown as { rentalStore?: ReturnType<typeof createStore> };
function store() { return globalStore.rentalStore ??= createStore(process.env.RENTAL_DB_PATH || resolve('data/rentals.sqlite')); }
export async function GET() { try { return NextResponse.json(store().snapshot(), {headers:{'X-Sejour-Demo':process.env.RENTAL_DEMO==='1'?'1':'0'}}); } catch (e) { console.error(e); return NextResponse.json({error:'Impossible de lire les données.'},{status:500}); } }
export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).host !== request.headers.get('host')) return NextResponse.json({error:'Origine non autorisée.'},{status:403});
  try {
    const body = await request.json();
    if (!body || typeof body.action !== 'string' || !body.input || typeof body.input !== 'object' || Array.isArray(body.input)) throw new UserError('Requête invalide.');
    return NextResponse.json(store().mutate(body.action, body.input));
  } catch (e) {
    if (e instanceof UserError) return NextResponse.json({error:e.message},{status:400});
    if (e instanceof SyntaxError) return NextResponse.json({error:'Requête invalide.'},{status:400});
    console.error(e); return NextResponse.json({error:'L’enregistrement a échoué. Réessayez.'},{status:500});
  }
}
