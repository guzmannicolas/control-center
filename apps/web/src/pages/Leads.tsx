import { useEffect, useState } from 'react';
import type { LeadView, LeadStatus } from '@cc/shared';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4101';

const STATUS_BADGES: Record<LeadStatus, { label: string; bg: string; color: string; border: string }> = {
 discovered: { label: 'Discovered', bg: '#1e293b', color: '#94a3b8', border: '#334155' },
 enriched: { label: 'Enriched (Data ready)', bg: '#1e3a8a', color: '#93c5fd', border: '#2563eb' },
 contacted: { label: 'Contacted', bg: '#422006', color: '#facc15', border: '#854d0e' },
 replied: { label: 'Replied ', bg: '#064e3b', color: '#34d399', border: '#059669' },
 converted: { label: 'Client Won! ', bg: '#052e16', color: '#4ade80', border: '#166534' },
 discarded: { label: 'Discarded', bg: '#450a0a', color: '#f87171', border: '#991b1b' },
};

export function LeadsPage() {
 const [leads, setLeads] = useState<LeadView[]>([]);
 const [loading, setLoading] = useState(true);
 const [scraping, setScraping] = useState(false);
 const [enrichingId, setEnrichingId] = useState<string | null>(null);

 // Form states
 const [category, setCategory] = useState('Odontology');
 const [city, setCity] = useState('Cordoba');
 const [limit, setLimit] = useState(15);
 const [filterWithoutWeb, setFilterWithoutWeb] = useState(false);
 const [search, setSearch] = useState('');

 const loadLeads = async () => {
 setLoading(true);
 try {
 const res = await fetch(`${API_BASE}/api/leads`, { credentials: 'include' });
 if (!res.ok) throw new Error('Error loading leads');
 const data = (await res.json()) as { leads: LeadView[] };
 setLeads(data.leads ?? []);
 } catch (err) {
 console.error(err);
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 void loadLeads();
 }, []);

 const handleScrape = async (e: React.FormEvent) => {
 e.preventDefault();
 if (scraping) return;
 setScraping(true);
 try {
 const res = await fetch(`${API_BASE}/api/leads/scrape`, {
 method: 'POST',
 credentials: 'include',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ category, city, limit }),
 });
 if (res.ok) {
 await loadLeads();
 }
 } catch (err) {
 console.error(err);
 } finally {
 setScraping(false);
 }
 };

 const handleEnrich = async (id: string) => {
 setEnrichingId(id);
 try {
 const res = await fetch(`${API_BASE}/api/leads/${id}/enrich`, {
 method: 'POST',
 credentials: 'include',
 });
 if (res.ok) {
 await loadLeads();
 }
 } catch (err) {
 console.error(err);
 } finally {
 setEnrichingId(null);
 }
 };

 const updateStatus = async (id: string, status: LeadStatus) => {
 try {
 await fetch(`${API_BASE}/api/leads/${id}`, {
 method: 'PATCH',
 credentials: 'include',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ status }),
 });
 setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
 } catch (err) {
 console.error(err);
 }
 };

 const deleteLead = async (id: string) => {
 if (!confirm('Delete this prospect?')) return;
 try {
 await fetch(`${API_BASE}/api/leads/${id}`, {
 method: 'DELETE',
 credentials: 'include',
 });
 setLeads((prev) => prev.filter((l) => l.id !== id));
 } catch (err) {
 console.error(err);
 }
 };

 const filtered = leads.filter((l) => {
 if (filterWithoutWeb && l.hasWebsite) return false;
 if (search.trim()) {
 const q = search.toLowerCase();
 return (
 l.name.toLowerCase().includes(q) ||
 l.city.toLowerCase().includes(q) ||
 (l.email?.toLowerCase().includes(q) ?? false) ||
 (l.phone?.includes(q) ?? false)
 );
 }
 return true;
 });

 return (
 <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
 {/* Header */}
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
 <div>
 <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
 <span></span> B2B Sales & Web Prospecting
 </h1>
 <p style={{ margin: '0.25rem 0 0', fontSize: '0.88rem', color: '#94a3b8' }}>
 Local business scraper, filter for companies without an existing website, and automated matching to Vercel live demos.
 </p>
 </div>
 </div>

 {/* Scraper Launcher Box */}
 <div style={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '12px', padding: '1.1rem' }}>
 <h2 style={{ margin: '0 0 0.8rem', fontSize: '1.05rem', color: '#f8fafc' }}>
 Launch New Prospecting Scan
 </h2>
 <form onSubmit={handleScrape} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end' }}>
 <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
 <label style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600 }}>Category / Niche</label>
 <input
 type="text"
 value={category}
 onChange={(e) => setCategory(e.target.value)}
 placeholder="e.g. Odontology, Barber Shop, Pizzeria"
 style={{
 background: '#0f172a',
 border: '1px solid #334155',
 color: '#f8fafc',
 borderRadius: '8px',
 padding: '0.5rem 0.8rem',
 fontSize: '0.85rem',
 minWidth: '200px',
 }}
 required
 />
 </div>

 <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
 <label style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600 }}>City / Area</label>
 <input
 type="text"
 value={city}
 onChange={(e) => setCity(e.target.value)}
 placeholder="e.g. Cordoba, Palermo Buenos Aires, Rosario"
 style={{
 background: '#0f172a',
 border: '1px solid #334155',
 color: '#f8fafc',
 borderRadius: '8px',
 padding: '0.5rem 0.8rem',
 fontSize: '0.85rem',
 minWidth: '180px',
 }}
 required
 />
 </div>

 <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
 <label style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600 }}>Max Results</label>
 <input
 type="number"
 value={limit}
 onChange={(e) => setLimit(Number(e.target.value))}
 min={1}
 max={50}
 style={{
 background: '#0f172a',
 border: '1px solid #334155',
 color: '#f8fafc',
 borderRadius: '8px',
 padding: '0.5rem 0.8rem',
 fontSize: '0.85rem',
 width: '80px',
 }}
 />
 </div>

 <button
 type="submit"
 disabled={scraping}
 style={{
 background: scraping ? '#1e3a8a' : '#2563eb',
 border: 'none',
 color: '#ffffff',
 borderRadius: '8px',
 padding: '0.55rem 1.2rem',
 fontSize: '0.85rem',
 fontWeight: 600,
 cursor: scraping ? 'wait' : 'pointer',
 }}
 >
 {scraping ? '⏳ Scraping in real-time...' : ' Start Scraping'}
 </button>
 </form>
 </div>

 {/* Filter and stats bar */}
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem' }}>
 <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
 <button
 type="button"
 onClick={() => setFilterWithoutWeb(!filterWithoutWeb)}
 style={{
 background: filterWithoutWeb ? '#052e16' : '#1e293b',
 border: `1px solid ${filterWithoutWeb ? '#22c55e' : '#334155'}`,
 color: filterWithoutWeb ? '#4ade80' : '#cbd5e1',
 borderRadius: '8px',
 padding: '0.45rem 0.85rem',
 fontSize: '0.8rem',
 fontWeight: 600,
 cursor: 'pointer',
 }}
 >
 {filterWithoutWeb ? ' Businesses WITHOUT website only' : 'Show all businesses'}
 </button>
 <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
 Total saved: <strong style={{ color: '#f8fafc' }}>{leads.length}</strong>
 </span>
 </div>

 <input
 type="text"
 placeholder="Filter by name, phone, email..."
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 style={{
 background: '#0f172a',
 border: '1px solid #334155',
 color: '#f8fafc',
 borderRadius: '8px',
 padding: '0.45rem 0.8rem',
 fontSize: '0.84rem',
 minWidth: '240px',
 }}
 />
 </div>

 {/* Leads Table */}
 <div style={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '12px', overflow: 'hidden' }}>
 <div style={{ overflowX: 'auto' }}>
 <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
 <thead>
 <tr style={{ background: '#0f172a', color: '#94a3b8', textAlign: 'left' }}>
 <th style={{ padding: '0.65rem 1rem' }}>Business</th>
 <th style={{ padding: '0.65rem 1rem' }}>Niche & Location</th>
 <th style={{ padding: '0.65rem 1rem' }}>Current Website</th>
 <th style={{ padding: '0.65rem 1rem' }}>Contact (WhatsApp / Email)</th>
 <th style={{ padding: '0.65rem 1rem' }}>Suggested Demo</th>
 <th style={{ padding: '0.65rem 1rem' }}>Status</th>
 <th style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>Actions</th>
 </tr>
 </thead>
 <tbody>
 {filtered.map((lead) => {
 const badge = STATUS_BADGES[lead.status] ?? STATUS_BADGES.discovered;
 const waNumber = lead.phoneFormatted ? lead.phoneFormatted.replace('+', '') : null;
 const waMessage = encodeURIComponent(
 `Hello ${lead.name}! I noticed your great reviews in Google around ${lead.city}. I wanted to check if you have an official website or if you'd like to check out a live proposal we designed for businesses in your field: ${lead.suggestedDemo ?? ''}`
 );

 return (
 <tr key={lead.id} style={{ borderTop: '1px solid #1e293b', color: '#e2e8f0' }}>
 {/* Name */}
 <td style={{ padding: '0.65rem 1rem' }}>
 <div style={{ fontWeight: 700, color: '#f8fafc' }}>{lead.name}</div>
 {lead.rating && (
 <div style={{ fontSize: '0.74rem', color: '#eab308' }}>
 {lead.rating} ({lead.reviewsCount} reviews)
 </div>
 )}
 </td>

 {/* Category & City */}
 <td style={{ padding: '0.65rem 1rem' }}>
 <div style={{ color: '#cbd5e1' }}>{lead.category}</div>
 <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{lead.city}</div>
 </td>

 {/* Website */}
 <td style={{ padding: '0.65rem 1rem' }}>
 {lead.hasWebsite && lead.website ? (
 <a
 href={lead.website}
 target="_blank"
 rel="noreferrer"
 style={{ color: '#60a5fa', textDecoration: 'none', fontSize: '0.78rem' }}
 >
 ↗ Has website
 </a>
 ) : (
 <span
 style={{
 background: '#450a0a',
 color: '#f87171',
 padding: '0.15rem 0.5rem',
 borderRadius: '6px',
 fontSize: '0.72rem',
 fontWeight: 700,
 }}
 >
 NO WEBSITE 
 </span>
 )}
 </td>

 {/* Contact */}
 <td style={{ padding: '0.65rem 1rem' }}>
 <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
 {lead.phone ? (
 <div style={{ fontFamily: 'monospace', color: '#93c5fd', fontSize: '0.78rem' }}>
 {lead.phone}
 </div>
 ) : null}
 {lead.email ? (
 <a
 href={`mailto:${lead.email}`}
 style={{ color: '#34d399', fontSize: '0.78rem', textDecoration: 'none' }}
 >
 ️ {lead.email}
 </a>
 ) : null}
 {lead.instagram ? (
 <a
 href={lead.instagram}
 target="_blank"
 rel="noreferrer"
 style={{ color: '#f472b6', fontSize: '0.75rem', textDecoration: 'none' }}
 >
 Instagram
 </a>
 ) : null}
 {!lead.email && !lead.phone && (
 <span style={{ fontSize: '0.74rem', color: '#64748b' }}>No contact info yet</span>
 )}
 </div>
 </td>

 {/* Suggested Demo */}
 <td style={{ padding: '0.65rem 1rem' }}>
 {lead.suggestedDemo ? (
 <a
 href={lead.suggestedDemo}
 target="_blank"
 rel="noreferrer"
 style={{
 color: '#a78bfa',
 textDecoration: 'none',
 fontSize: '0.76rem',
 fontWeight: 600,
 display: 'inline-flex',
 alignItems: 'center',
 gap: '0.2rem',
 }}
 >
 Vercel Demo ↗
 </a>
 ) : (
 '—'
 )}
 </td>

 {/* Status */}
 <td style={{ padding: '0.65rem 1rem' }}>
 <select
 value={lead.status}
 onChange={(e) => void updateStatus(lead.id, e.target.value as LeadStatus)}
 style={{
 background: badge.bg,
 color: badge.color,
 border: `1px solid ${badge.border}`,
 borderRadius: '6px',
 padding: '0.2rem 0.4rem',
 fontSize: '0.74rem',
 fontWeight: 700,
 cursor: 'pointer',
 }}
 >
 {Object.entries(STATUS_BADGES).map(([key, item]) => (
 <option key={key} value={key} style={{ background: '#0f172a', color: '#f8fafc' }}>
 {item.label}
 </option>
 ))}
 </select>
 </td>

 {/* Actions */}
 <td style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>
 <div style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}>
 {waNumber && (
 <a
 href={`https://wa.me/${waNumber}?text=${waMessage}`}
 target="_blank"
 rel="noreferrer"
 onClick={() => void updateStatus(lead.id, 'contacted')}
 style={{
 background: '#064e3b',
 border: '1px solid #059669',
 color: '#6ee7b7',
 padding: '0.25rem 0.55rem',
 borderRadius: '6px',
 fontSize: '0.75rem',
 textDecoration: 'none',
 fontWeight: 600,
 }}
 >
 WhatsApp
 </a>
 )}

 <button
 type="button"
 onClick={() => void handleEnrich(lead.id)}
 disabled={enrichingId === lead.id}
 title="Search public email and Instagram profile"
 style={{
 background: '#1e293b',
 border: '1px solid #334155',
 color: '#cbd5e1',
 padding: '0.25rem 0.5rem',
 borderRadius: '6px',
 fontSize: '0.75rem',
 cursor: 'pointer',
 }}
 >
 {enrichingId === lead.id ? '...' : ' Find Socials'}
 </button>

 <button
 type="button"
 onClick={() => void deleteLead(lead.id)}
 style={{
 background: 'transparent',
 border: 'none',
 color: '#ef4444',
 cursor: 'pointer',
 padding: '0.2rem',
 }}
 >
 
 </button>
 </div>
 </td>
 </tr>
 );
 })}
 {filtered.length === 0 && !loading && (
 <tr>
 <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
 No prospects found. Launch a new scan above to get started!
 </td>
 </tr>
 )}
 </tbody>
 </table>
 </div>
 </div>
 </div>
 );
}
