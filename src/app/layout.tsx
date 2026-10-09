import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Séjour — Gestion de locations', description: 'Votre quotidien de gestion locative, en toute simplicité.' };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="fr"><body>{children}</body></html>; }
