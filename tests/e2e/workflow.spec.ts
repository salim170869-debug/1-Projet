import { test, expect } from '@playwright/test';

test('Parcours complet : logement, voyageur, réservation, ménage et paiement',async({page,request})=>{
  const year=new Date().getFullYear()+1;
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize({width:1440,height:1000});
  await page.goto('/');await expect(page.getByRole('heading',{name:'Bienvenue chez vous.'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Ajouter mon premier logement'})).toBeVisible();
  await page.screenshot({path:'test-results/dashboard-empty.png',fullPage:true});
  await page.getByRole('button',{name:'Ajouter mon premier logement'}).click();
  await page.getByLabel('Nom du logement').fill('Maison des Oliviers');
  await page.getByLabel('Adresse',{exact:true}).fill('12 rue du Port, La Rochelle');
  await page.getByLabel('Capacité d’accueil').fill('4');await page.getByLabel('Tarif par nuit (€)').fill('125');
  await page.getByRole('button',{name:'Enregistrer',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button',{name:'Voyageurs',exact:true}).click();await page.getByRole('button',{name:'Ajouter un voyageur'}).first().click();
  await page.getByLabel('Nom et prénom').fill('Camille Martin');await page.getByLabel('Email',{exact:true}).fill('camille@example.fr');
  await page.getByLabel('Téléphone').fill('0612345678');await page.getByRole('button',{name:'Enregistrer',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button',{name:'Réservations',exact:true}).click();await page.getByRole('button',{name:'Nouvelle réservation'}).first().click();
  await page.getByLabel('Date d’arrivée').fill(`${year}-05-10`);await page.getByLabel('Date de départ').fill(`${year}-05-14`);await page.getByLabel('Montant total du séjour (€)').fill('500');
  await page.getByRole('button',{name:'Enregistrer',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByRole('cell',{name:'Camille Martin Maison des Oliviers'})).toBeVisible();
  // Un second séjour en conflit doit rester dans le formulaire avec une erreur claire.
  await page.getByRole('button',{name:'Nouvelle réservation'}).click();await page.getByLabel('Date d’arrivée').fill(`${year}-05-12`);await page.getByLabel('Date de départ').fill(`${year}-05-15`);await page.getByLabel('Montant total du séjour (€)').fill('375');
  await page.getByRole('button',{name:'Enregistrer',exact:true}).click();await expect(page.getByRole('dialog').getByRole('alert')).toHaveText('Ce logement est déjà réservé sur ces dates.');await page.getByRole('button',{name:'Annuler',exact:true}).click();
  await page.getByRole('button',{name:/^Ménages/}).click();await expect(page.getByText('Lié au départ d’une réservation')).toBeVisible();
  await page.getByRole('button',{name:`Modifier le ménage du ${year}-05-14`}).click();await page.getByLabel('Personne responsable').fill('Sophie');await page.getByLabel('Statut',{exact:true}).selectOption('done');await page.getByRole('button',{name:'Enregistrer',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByRole('table').getByText('Terminé',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Revenus',exact:true}).click();await page.getByRole('button',{name:'Enregistrer un paiement'}).first().click();
  await page.getByLabel('Montant reçu (€)').fill('200');await page.getByRole('button',{name:'Enregistrer',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  const response=await request.get('/api/data');expect(response.ok()).toBeTruthy();const data=await response.json();expect(data.bookings).toHaveLength(1);expect(data.payments[0].amount).toBe(20000);expect(data.cleanings[0].assignee).toBe('Sophie');expect(data.cleanings[0].status).toBe('done');
  await expect(page.locator('.income-stats')).toContainText('300,00');await page.reload();await expect(page.locator('.income-stats')).toContainText('200,00');
  await page.getByRole('button',{name:'Vue d’ensemble',exact:true}).click();await expect(page.getByText('Camille Martin',{exact:true})).toBeVisible();await page.screenshot({path:'test-results/dashboard-filled.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'test-results/dashboard-mobile.png',fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();
  await page.getByRole('button',{name:'Logements',exact:true}).click();await expect(page.getByRole('heading',{name:'Maison des Oliviers'})).toBeVisible();
  expect(errors).toEqual([]);
});

test('L’API refuse une mutation depuis une autre origine',async({request})=>{
  const response=await request.post('/api/data',{headers:{Origin:'https://autre-site.example'},data:{action:'guest',input:{name:'Non autorisé'}}});
  expect(response.status()).toBe(403);
});
