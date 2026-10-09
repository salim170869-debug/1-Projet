'use client';
import { useEffect, useState, useId, Children, cloneElement, isValidElement, type FormEvent } from 'react';
import type { Data, Unit, Guest, Booking, Cleaning } from '@/lib/store';

type Section = 'dashboard' | 'units' | 'bookings' | 'guests' | 'cleanings' | 'payments';
type Editor = { action: 'unit'|'guest'|'booking'|'cleaning'|'payment'; item?: Unit|Guest|Booking|Cleaning };
const empty: Data = { units: [], guests: [], bookings: [], cleanings: [], payments: [] };
const euro = (cents: number) => new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(cents/100);
const dayLabel = (date: string) => new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'short',year:'numeric'}).format(new Date(date+'T12:00:00'));
function today() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
const labels: Record<string,string> = { confirmed:'Confirmée',pending:'À confirmer',cancelled:'Annulée',todo:'À faire',progress:'En cours',done:'Terminé',transfer:'Virement',card:'Carte',cash:'Espèces',other:'Autre' };
const sections: {id:Section;label:string;icon:string;description:string}[] = [
  {id:'dashboard',label:'Vue d’ensemble',icon:'grid',description:'Un regard sur vos séjours, pour une journée bien organisée.'},
  {id:'units',label:'Logements',icon:'home',description:'Chaque adresse a son histoire. Retrouvez-les toutes ici.'},
  {id:'bookings',label:'Réservations',icon:'calendar',description:'Des arrivées aux départs, gardez le fil de vos séjours.'},
  {id:'guests',label:'Voyageurs',icon:'users',description:'Les bonnes informations pour accueillir vos voyageurs.'},
  {id:'cleanings',label:'Ménages',icon:'spark',description:'Des logements prêts pour chaque nouvelle arrivée.'},
  {id:'payments',label:'Revenus',icon:'wallet',description:'Distinguez vos réservations des paiements réellement reçus.'},
];
function Icon({name,size=20}:{name:string;size?:number}) {
  const paths:Record<string,React.ReactNode> = {
    grid:<><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
    home:<><path d="M3 10 12 3l9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z"/><path d="M9 21v-8h6v8"/></>,
    calendar:<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18m-13 4h2m4 0h2"/></>,
    users:<><circle cx="9" cy="8" r="3"/><path d="M3 21v-2a6 6 0 0 1 12 0v2m2-16a3 3 0 0 1 0 6m1 4a5 5 0 0 1 3 4v2"/></>,
    spark:<><path d="m12 3 2.6 6.4L21 12l-6.4 2.6L12 21l-2.6-6.4L3 12l6.4-2.6ZM20 2v4m-2-2h4"/></>,
    wallet:<><path d="M21 8H5a2 2 0 0 1 0-4h14v4M3 6v13a2 2 0 0 0 2 2h16V8m0 5h-6v4h6"/><path d="M17 15h.01"/></>,
    arrow:<path d="M5 12h14m-5-5 5 5-5 5"/>,
    plus:<path d="M12 5v14M5 12h14"/>,
    search:<><circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/></>,
    close:<path d="m6 6 12 12M6 18 18 6"/>,
    check:<path d="m5 12 4 4L19 6"/>,
    edit:<><path d="m14 4 6 6M4 20l5-1L21 7l-6-6L3 13Z"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.home}</svg>;
}
function Badge({status}:{status:string}) { return <span className={`badge ${status}`}>{labels[status] || status}</span>; }

export default function RentalApp() {
  const [data,setData] = useState<Data>(empty), [section,setSection] = useState<Section>('dashboard');
  const [loading,setLoading] = useState(true), [error,setError] = useState(''), [notice,setNotice] = useState('');
  const [editor,setEditor] = useState<Editor|null>(null), [busy,setBusy] = useState(false), [formError,setFormError] = useState('');
  const [search,setSearch] = useState(''), [status,setStatus] = useState('all');
  const [deletion,setDeletion] = useState<{entity:string;id:number;label:string}|null>(null);
  const [month,setMonth] = useState('');
  async function load() {
    setLoading(true); setError('');
    try { const response = await fetch('/api/data',{cache:'no-store'}); const body = await response.json(); if (!response.ok) throw new Error(body.error); setData(body); }
    catch (e) { setError(e instanceof Error ? e.message : 'Connexion impossible.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); },[]);
  useEffect(() => {
    function syncSection() {
      const hash=window.location.hash.slice(1);
      setSection(sections.some(s=>s.id===hash)?hash as Section:'dashboard');
      setSearch('');setStatus('all');setMonth('');
    }
    syncSection();window.addEventListener('hashchange',syncSection);
    return () => window.removeEventListener('hashchange',syncSection);
  },[]);
  useEffect(() => {
    if (!editor && !deletion) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled):not([type="hidden"]),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]') || []);
    const frame = requestAnimationFrame(() => { if (!dialog?.contains(document.activeElement)) focusable()[0]?.focus(); });
    const oldOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const handler = (e:KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) {setEditor(null);setDeletion(null);}
      if (e.key === 'Tab') {const items=focusable(),first=items[0],last=items[items.length-1];if (e.shiftKey && document.activeElement===first) {e.preventDefault();last?.focus();} else if (!e.shiftKey && document.activeElement===last) {e.preventDefault();first?.focus();}}
    };
    document.addEventListener('keydown',handler);
    return () => {cancelAnimationFrame(frame);document.removeEventListener('keydown',handler);document.body.style.overflow=oldOverflow;if (previous?.isConnected) previous.focus();};
  },[editor,deletion,busy]);
  const now = today();
  const unitName = (id:number) => data.units.find(u=>u.id===id)?.name || 'Logement supprimé';
  const guestName = (id:number) => data.guests.find(g=>g.id===id)?.name || 'Voyageur supprimé';
  const paid = (id:number) => data.payments.filter(p=>p.bookingId===id).reduce((a,p)=>a+p.amount,0);
  const activeBookings = data.bookings.filter(b=>b.status!=='cancelled');
  const received = data.payments.filter(p=>!month || p.date.startsWith(month)).reduce((a,p)=>a+p.amount,0);
  const booked = activeBookings.filter(b=>!month || b.arrival.startsWith(month)).reduce((a,b)=>a+b.amount,0);
  const remaining = activeBookings.filter(b=>!month || b.arrival.startsWith(month)).reduce((a,b)=>a+b.amount-paid(b.id),0);
  const occupied = new Set(activeBookings.filter(b=>b.status==='confirmed' && b.arrival<=now && b.departure>now).map(b=>b.unitId)).size;
  const upcoming = activeBookings.filter(b=>b.departure>=now).sort((a,b)=>a.arrival.localeCompare(b.arrival)).slice(0,5);
  const todo = data.cleanings.filter(c=>c.status!=='done').sort((a,b)=>a.date.localeCompare(b.date));
  const meta = sections.find(s=>s.id===section)!;
  const addLabel:Record<Section,string> = {dashboard:'Nouvelle réservation',units:'Ajouter un logement',bookings:'Nouvelle réservation',guests:'Ajouter un voyageur',cleanings:'Planifier un ménage',payments:'Enregistrer un paiement'};
  function go(s:Section) { window.history.pushState(null,'',`#${s}`);setSection(s);setSearch('');setStatus('all');setMonth('');setError(''); }
  function open(action:Editor['action'],item?:Editor['item']) {setFormError('');setEditor({action,item});setNotice('');}
  function add() { const actions:Record<Section,Editor['action']> = {dashboard:'booking',units:'unit',bookings:'booking',guests:'guest',cleanings:'cleaning',payments:'payment'};open(actions[section]); }
  async function mutate(action:string,input:Record<string,unknown>) {
    const response = await fetch('/api/data',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,input})});
    const body = await response.json(); if (!response.ok) throw new Error(body.error || 'L’enregistrement a échoué.'); setData(body);
  }
  async function submit(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();if (!editor || busy) return;setBusy(true);setFormError('');
    const fields = Object.fromEntries(new FormData(e.currentTarget));
    const input:Record<string,unknown> = {...fields};
    if (editor.item) input.id=editor.item.id;
    for (const key of ['unitId','guestId','bookingId','capacity']) if (key in input) input[key]=Number(input[key]);
    for (const key of ['nightlyRate','amount']) if (key in input) input[key]=Math.round(Number(input[key])*100);
    try { await mutate(editor.action,input);setEditor(null);setNotice(editor.item?'Modifications enregistrées.':'Enregistrement effectué.'); }
    catch (e) {setFormError(e instanceof Error ? e.message : 'Une erreur est survenue.');}
    finally {setBusy(false);}
  }
  async function remove() {
    if (!deletion || busy) return;setBusy(true);setFormError('');
    try {await mutate('delete',{entity:deletion.entity,id:deletion.id});setDeletion(null);setNotice('Élément supprimé.');}
    catch(e) {setFormError(e instanceof Error ? e.message : 'Une erreur est survenue.');}
    finally {setBusy(false);}
  }
  const matches = (...texts:string[]) => texts.join(' ').toLocaleLowerCase('fr').includes(search.toLocaleLowerCase('fr'));
  function actions(action:Editor['action'],item:Editor['item'],entity:string,label:string) {return <div className="row-actions"><button className="icon-button" onClick={()=>open(action,item)} aria-label={`Modifier ${label}`} title="Modifier"><Icon name="edit" size={16}/></button><button className="delete-button" onClick={()=>{setFormError('');setDeletion({entity,id:item!.id,label});}} aria-label={`Supprimer ${label}`}>Supprimer</button></div>;}
  function emptyState(title:string,description:string,button?:string,onClick?:()=>void) {return <div className="empty-state"><div className="empty-icon"><Icon name={meta.icon} size={30}/></div><h3>{title}</h3><p>{description}</p>{button && <button className="primary" onClick={onClick || add}><Icon name="plus" size={17}/>{button}</button>}</div>;}
  function bookingTable(bookings:Booking[],compact=false) {return <div className="table-scroll"><table><thead><tr><th>Voyageur & logement</th><th>Séjour</th><th>Statut</th><th>Montant</th>{!compact && <><th>À recevoir</th><th><span className="sr-only">Actions</span></th></>}</tr></thead><tbody>{bookings.map(b=><tr key={b.id}><td><strong>{guestName(b.guestId)}</strong><small>{unitName(b.unitId)}</small></td><td>{dayLabel(b.arrival)}<small>→ {dayLabel(b.departure)} · {Math.round((Date.parse(b.departure)-Date.parse(b.arrival))/86400000)} nuits</small></td><td><Badge status={b.status}/></td><td className="money">{euro(b.amount)}</td>{!compact && <><td className="money">{b.status==='cancelled'?'—':euro(b.amount-paid(b.id))}</td><td>{actions('booking',b,'bookings',`la réservation de ${guestName(b.guestId)}`)}</td></>}</tr>)}</tbody></table></div>;}
  const item = editor?.item as unknown as Record<string,string|number>|undefined;
  const value = (key:string,fallback:string|number='') => item?.[key] ?? fallback;
  const titles = {unit:'logement',guest:'voyageur',booking:'réservation',cleaning:'ménage',payment:'paiement'};
  const prerequisites = editor?.action==='booking' ? !data.units.length ? 'Ajoutez d’abord un logement.' : !data.guests.length ? 'Ajoutez d’abord un voyageur.' : '' : editor?.action==='cleaning' && !data.units.length ? 'Ajoutez d’abord un logement.' : editor?.action==='payment' && !activeBookings.some(b=>paid(b.id)<b.amount) ? 'Ajoutez une réservation avec un solde à recevoir.' : '';
  return <div className="app-shell">
    <aside className="sidebar"><a className="brand" href="/" aria-label="Séjour, accueil"><span className="brand-mark"><Icon name="home" size={25}/></span>Séjour<span className="brand-dot">.</span></a><div className="workspace"><div className="workspace-avatar">ML</div><div><strong>Mes locations</strong><small>Espace de gestion</small></div></div><p className="nav-label">VOTRE QUOTIDIEN</p><nav aria-label="Navigation principale">{sections.map(s=><button key={s.id} className={`nav-item ${section===s.id?'active':''}`} onClick={()=>go(s.id)} aria-current={section===s.id?'page':undefined}><Icon name={s.icon}/>{s.label}{s.id==='cleanings' && todo.length>0 && <span className="nav-count">{todo.length}</span>}</button>)}</nav><div className="sidebar-note"><span className="status-dot"/><strong>Tout commence ici</strong><p>Vos logements, vos séjours.<br/>Un seul endroit pour les gérer.</p></div><div className="sidebar-bottom"><span className="user-avatar">M</span><div><strong>Mon espace</strong><small>Version locale · v1</small></div></div></aside>
    <main className="main"><header className="topbar"><span>Mes locations <span className="crumb">/</span> <strong>{meta.label}</strong></span><span className="today">{loading?'Votre espace de gestion':new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'long',year:'numeric'}).format(new Date())}</span></header><div className="content"><div className="page-heading"><div><div className="eyebrow">GESTION DE LOCATIONS SAISONNIÈRES</div><h1>{section==='dashboard'?'Bienvenue chez vous.':meta.label}</h1><p>{meta.description}</p></div><button className="primary" onClick={add} disabled={loading || !!error}><Icon name="plus" size={18}/>{addLabel[section]}</button></div>
    {notice && <div className="notice" role="status"><Icon name="check" size={18}/>{notice}<button aria-label="Fermer la notification" onClick={()=>setNotice('')}><Icon name="close" size={16}/></button></div>}
    {error && <div className="error-banner" role="alert">{error}<button onClick={()=>void load()}>Réessayer</button></div>}
    {loading ? <div className="loading" role="status">Chargement de votre espace…</div> : !error && <>
    {section==='dashboard' && <>
      <div className="stats"><Metric title="Logements" amount={String(data.units.length)} detail={`${occupied} occupé${occupied>1?'s':''} aujourd’hui`} icon="home"/><Metric title="Séjours à venir ou en cours" amount={String(activeBookings.filter(b=>b.departure>=now).length)} detail="Réservations non annulées" icon="calendar"/><Metric title="Paiements reçus" amount={euro(received)} detail="Total réellement encaissé" icon="wallet"/><Metric title="Ménages à effectuer" amount={String(todo.length)} detail={`${todo.filter(c=>c.date<now).length} en retard`} icon="spark"/></div>
      {!data.units.length && <div className="welcome-card"><div><span className="eyebrow">VOTRE PREMIER PAS</span><h2>Faites une place à votre premier logement.</h2><p>Ajoutez une adresse, accueillez vos voyageurs,<br/>et laissez votre organisation prendre forme.</p><button className="primary" onClick={()=>open('unit')}>Ajouter mon premier logement<Icon name="arrow" size={17}/></button></div><div className="house-illustration" aria-hidden="true"><div className="sun"/><div className="house-roof"/><div className="house-body"><div className="window"/><div className="door"/></div><div className="plant">✦</div><div className="ground"/></div></div>}
      <div className="dashboard-grid"><section className="panel"><div className="panel-heading"><div><h2>Prochains séjours</h2><p>Vos arrivées et séjours en cours</p></div><button className="text-button" onClick={()=>go('bookings')}>Tout voir <Icon name="arrow" size={16}/></button></div>{upcoming.length ? bookingTable(upcoming,true) : <div className="small-empty"><Icon name="calendar" size={32}/><h3>Les prochains séjours apparaîtront ici</h3><p>Ajoutez une réservation pour organiser votre accueil.</p><button className="text-button" onClick={()=>open('booking')}>Créer une réservation <Icon name="arrow" size={16}/></button></div>}</section><section className="panel"><div className="panel-heading"><div><h2>Côté ménages</h2><p>Les prochaines interventions</p></div><button className="text-button" onClick={()=>go('cleanings')}>Voir tout</button></div>{todo.length ? <div className="cleaning-list">{todo.slice(0,5).map(c=><button key={c.id} className="cleaning-card" onClick={()=>open('cleaning',c)}><span className="cleaning-icon"><Icon name="spark"/></span><div><strong>{unitName(c.unitId)}</strong><small>{dayLabel(c.date)} · {c.assignee || 'À attribuer'}</small></div><Badge status={c.status}/></button>)}</div> : <div className="small-empty"><Icon name="spark" size={32}/><h3>Tout est en ordre</h3><p>Les ménages liés aux nouvelles réservations seront ajoutés automatiquement.</p></div>}</section></div>
      <div className="quiet-note"><span className="status-dot"/>Vos données sont enregistrées dans cet environnement local.</div>
    </>}
    {section!=='dashboard' && <>
      {section==='payments' && <><div className="income-intro"><label>Période <input type="month" value={month} onChange={e=>setMonth(e.target.value)}/></label>{month && <button className="text-button" onClick={()=>setMonth('')}>Toutes les dates</button>}<span>Réservations par mois d’arrivée · encaissements par date de paiement</span></div><div className="stats income-stats"><Metric title="Montant des réservations" amount={euro(booked)} detail="Hors réservations annulées" icon="calendar"/><Metric title="Paiements reçus" amount={euro(received)} detail="Encaissés sur la période" icon="wallet"/><Metric title="Solde à recevoir" amount={euro(remaining)} detail="Pour les séjours de la période" icon="wallet"/></div></>}
      <section className="panel"><div className="list-toolbar"><h2>{section==='payments'?'Historique des paiements':meta.label}<span className="count">{data[section].length}</span></h2><div className="filters"><div className="search"><Icon name="search" size={18}/><input aria-label="Rechercher" placeholder="Rechercher…" value={search} onChange={e=>setSearch(e.target.value)}/></div>{(section==='bookings' || section==='cleanings') && <select aria-label="Filtrer par statut" value={status} onChange={e=>setStatus(e.target.value)}><option value="all">Tous les statuts</option>{(section==='bookings'?['confirmed','pending','cancelled']:['todo','progress','done']).map(s=><option key={s} value={s}>{labels[s]}</option>)}</select>}</div></div>
      {section==='units' && (data.units.length ? <div className="unit-grid">{data.units.filter(u=>matches(u.name,u.address,u.notes)).map(u=><article className="unit-card" key={u.id}><div className="unit-art"><Icon name="home" size={48}/><span>{u.capacity} personne{u.capacity>1?'s':''}</span></div><div className="unit-content"><h3>{u.name}</h3><p>{u.address}</p><div className="unit-rate"><strong>{euro(u.nightlyRate)}</strong><span>/ nuit</span></div>{u.notes && <p className="unit-notes">{u.notes}</p>}{actions('unit',u,'units',u.name)}</div></article>)}{!data.units.some(u=>matches(u.name,u.address,u.notes)) && <p className="no-results">Aucun logement ne correspond à votre recherche.</p>}</div> : emptyState('Votre première adresse vous attend','Ajoutez un logement pour commencer à organiser vos locations.','Ajouter un logement'))}
      {section==='bookings' && (data.bookings.length ? (()=>{const rows=data.bookings.filter(b=>matches(unitName(b.unitId),guestName(b.guestId),b.notes) && (status==='all' || b.status===status));return rows.length?bookingTable(rows):<p className="no-results">Aucune réservation ne correspond aux filtres.</p>;})() : emptyState('Un nouveau séjour commence ici','Choisissez un logement, un voyageur et les dates du séjour.','Nouvelle réservation'))}
      {section==='guests' && (data.guests.length ? <div className="table-scroll"><table><thead><tr><th>Voyageur</th><th>Coordonnées</th><th>Séjours</th><th>Notes</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{data.guests.filter(g=>matches(g.name,g.email,g.phone)).map(g=><tr key={g.id}><td><div className="guest-name"><span className="guest-avatar">{g.name.slice(0,1).toUpperCase()}</span><strong>{g.name}</strong></div></td><td>{g.email || 'Email non renseigné'}<small>{g.phone || 'Téléphone non renseigné'}</small></td><td><button className="text-button" onClick={()=>{go('bookings');setSearch(g.name);}}>{data.bookings.filter(b=>b.guestId===g.id).length} séjour(s)</button></td><td className="notes-cell">{g.notes || '—'}</td><td>{actions('guest',g,'guests',g.name)}</td></tr>)}</tbody></table>{!data.guests.some(g=>matches(g.name,g.email,g.phone)) && <p className="no-results">Aucun voyageur ne correspond à votre recherche.</p>}</div>:emptyState('Faites connaissance avec vos voyageurs','Conservez leurs coordonnées et retrouvez leurs séjours au même endroit.','Ajouter un voyageur'))}
      {section==='cleanings' && (data.cleanings.length ? <div className="table-scroll"><table><thead><tr><th>Logement</th><th>Date</th><th>Responsable</th><th>Statut</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{data.cleanings.filter(c=>matches(unitName(c.unitId),c.assignee) && (status==='all'||c.status===status)).sort((a,b)=>a.date.localeCompare(b.date)).map(c=><tr key={c.id}><td><strong>{unitName(c.unitId)}</strong><small>{c.bookingId?'Lié au départ d’une réservation':'Intervention ponctuelle'}</small></td><td>{dayLabel(c.date)}{c.date<now && c.status!=='done' && <small className="overdue">En retard</small>}</td><td>{c.assignee||'À attribuer'}</td><td><Badge status={c.status}/></td><td>{actions('cleaning',c,'cleanings',`le ménage du ${c.date}`)}</td></tr>)}</tbody></table>{!data.cleanings.some(c=>matches(unitName(c.unitId),c.assignee) && (status==='all'||c.status===status)) && <p className="no-results">Aucun ménage ne correspond aux filtres.</p>}</div>:emptyState('Préparez le prochain accueil','Les réservations créent un ménage automatiquement. Vous pouvez aussi en planifier un.','Planifier un ménage'))}
      {section==='payments' && (data.payments.length ? <div className="table-scroll"><table><thead><tr><th>Réservation</th><th>Date du paiement</th><th>Moyen de paiement</th><th>Montant reçu</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{data.payments.filter(p=>{const b=data.bookings.find(b=>b.id===p.bookingId)!;return (!month||p.date.startsWith(month)) && matches(guestName(b.guestId),unitName(b.unitId));}).map(p=>{const b=data.bookings.find(b=>b.id===p.bookingId)!;return <tr key={p.id}><td><strong>{guestName(b.guestId)}</strong><small>{unitName(b.unitId)} · arrivée le {dayLabel(b.arrival)}</small></td><td>{dayLabel(p.date)}</td><td>{labels[p.method]}</td><td className="money">{euro(p.amount)}</td><td><button className="delete-button" onClick={()=>{setFormError('');setDeletion({entity:'payments',id:p.id,label:`le paiement de ${euro(p.amount)}`});}}>Supprimer</button></td></tr>;})}</tbody></table>{!data.payments.some(p=>{const b=data.bookings.find(b=>b.id===p.bookingId)!;return (!month||p.date.startsWith(month)) && matches(guestName(b.guestId),unitName(b.unitId));}) && <p className="no-results">Aucun paiement ne correspond aux filtres.</p>}</div>:emptyState('Vos premiers encaissements apparaîtront ici','Enregistrez un paiement reçu pour suivre le solde de chaque réservation.','Enregistrer un paiement'))}
      </section>
    </>}
    </>}
    <footer>Séjour <span>•</span> L’esprit libre, les séjours bien organisés.</footer></div></main>
    {editor && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-header"><div><span className="eyebrow">MES LOCATIONS</span><h2 id="modal-title">{editor.item?'Modifier':'Ajouter'} {editor.action==='booking'?'une':editor.action==='unit'||editor.action==='guest'||editor.action==='cleaning'||editor.action==='payment'?'un':''} {titles[editor.action]}</h2></div><button className="icon-button" onClick={()=>!busy&&setEditor(null)} aria-label="Fermer" disabled={busy}><Icon name="close"/></button></div>{prerequisites ? <div className="modal-body"><p>{prerequisites}</p><button className="primary" autoFocus onClick={()=>open(editor.action==='booking'&&!data.units.length || editor.action==='cleaning'?'unit':editor.action==='booking'?'guest':'booking')}>Continuer</button></div>:<form onSubmit={submit}><div className="modal-body form-grid">
      {editor.action==='unit' && <><Field label="Nom du logement"><input name="name" required autoFocus defaultValue={value('name')} placeholder="Ex. Maison des Oliviers" maxLength={200}/></Field><Field label="Adresse"><input name="address" required defaultValue={value('address')} placeholder="Adresse complète" maxLength={500}/></Field><Field label="Capacité d’accueil" half><input name="capacity" type="number" min="1" max="1000" step="1" required defaultValue={value('capacity',2)}/></Field><Field label="Tarif par nuit (€)" half><input name="nightlyRate" type="number" min="0" max="1000000" step="0.01" required defaultValue={Number(value('nightlyRate',0))/100}/></Field></>}
      {editor.action==='guest' && <><Field label="Nom et prénom"><input name="name" required autoFocus defaultValue={value('name')} placeholder="Ex. Camille Martin" maxLength={200}/></Field><Field label="Email" half><input name="email" type="email" defaultValue={value('email')} placeholder="camille@exemple.fr"/></Field><Field label="Téléphone" half><input name="phone" type="tel" defaultValue={value('phone')} placeholder="06 12 34 56 78"/></Field></>}
      {(editor.action==='booking'||editor.action==='cleaning') && <Field label="Logement"><select name="unitId" required autoFocus defaultValue={value('unitId',data.units[0]?.id)} disabled={editor.action==='cleaning' && !!(editor.item as Cleaning)?.bookingId}>{data.units.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select>{editor.action==='cleaning' && !!(editor.item as Cleaning)?.bookingId && <input type="hidden" name="unitId" value={value('unitId')}/>}</Field>}
      {editor.action==='booking' && <><Field label="Voyageur"><select name="guestId" required defaultValue={value('guestId',data.guests[0]?.id)}>{data.guests.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></Field><Field label="Date d’arrivée" half><input type="date" name="arrival" required defaultValue={value('arrival',now)}/></Field><Field label="Date de départ" half><input type="date" name="departure" required defaultValue={value('departure')}/></Field><Field label="Montant total du séjour (€)" half><input name="amount" type="number" min="0" max="1000000" step="0.01" required defaultValue={Number(value('amount',0))/100}/></Field><Field label="Statut" half><select name="status" defaultValue={value('status','confirmed')}>{['confirmed','pending','cancelled'].map(s=><option value={s} key={s}>{labels[s]}</option>)}</select></Field><p className="form-help">Un ménage est planifié automatiquement le jour du départ. Le montant total est à saisir, frais inclus.</p></>}
      {editor.action==='cleaning' && <><Field label="Date d’intervention"><input type="date" name="date" required defaultValue={value('date',now)}/></Field><Field label="Personne responsable"><input name="assignee" defaultValue={value('assignee')} placeholder="Ex. Sophie"/></Field><Field label="Statut"><select name="status" defaultValue={value('status','todo')}>{['todo','progress','done'].map(s=><option value={s} key={s}>{labels[s]}</option>)}</select></Field></>}
      {editor.action==='payment' && <><Field label="Réservation"><select name="bookingId" required autoFocus>{activeBookings.filter(b=>paid(b.id)<b.amount).map(b=><option key={b.id} value={b.id}>{guestName(b.guestId)} · {unitName(b.unitId)} · {dayLabel(b.arrival)} · reste {euro(b.amount-paid(b.id))}</option>)}</select></Field><Field label="Montant reçu (€)" half><input type="number" name="amount" min="0.01" max="1000000" step="0.01" required/></Field><Field label="Date du paiement" half><input type="date" name="date" required defaultValue={now}/></Field><Field label="Moyen de paiement"><select name="method">{['transfer','card','cash','other'].map(s=><option key={s} value={s}>{labels[s]}</option>)}</select></Field><p className="form-help">Cet écran enregistre un paiement déjà reçu ; il ne prélève pas le voyageur.</p></>}
      {['unit','guest','booking'].includes(editor.action) && <Field label="Notes (facultatif)"><textarea name="notes" rows={3} defaultValue={value('notes')} maxLength={2000} placeholder="Une information utile à garder…"/></Field>}
      {formError && <p className="form-error" role="alert">{formError}</p>}
      </div><div className="modal-footer"><button type="button" className="secondary" onClick={()=>setEditor(null)} disabled={busy}>Annuler</button><button type="submit" className="primary" disabled={busy}>{busy?'Enregistrement…':'Enregistrer'}</button></div></form>}</section></div>}
    {deletion && <div className="modal-backdrop"><section className="modal confirmation" role="dialog" aria-modal="true" aria-labelledby="delete-title"><h2 id="delete-title">Supprimer cet élément ?</h2><p>Vous allez supprimer {deletion.label}. Cette action est définitive.</p>{deletion.entity==='bookings' && <p>Le ménage lié sera également supprimé.</p>}{formError && <p className="form-error" role="alert">{formError}</p>}<div className="modal-footer"><button className="secondary" autoFocus disabled={busy} onClick={()=>setDeletion(null)}>Conserver</button><button className="danger" disabled={busy} onClick={()=>void remove()}>{busy?'Suppression…':'Supprimer'}</button></div></section></div>}
  </div>;
}
function Field({label,half,children}:{label:string;half?:boolean;children:React.ReactNode}) {
  const id=useId();
  return <div className={`field ${half?'half':''}`}><label htmlFor={id}>{label}</label>{Children.map(children,child=>isValidElement<{type?:string;id?:string}>(child) && child.props.type!=='hidden' ? cloneElement(child,{id}) : child)}</div>;
}
function Metric({title,amount,detail,icon}:{title:string;amount:string;detail:string;icon:string}) {return <div className="metric"><div className="metric-heading"><span>{title}</span><span className="metric-icon"><Icon name={icon} size={19}/></span></div><strong className="metric-amount">{amount}</strong><p>{detail}</p></div>;}
