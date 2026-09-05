import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { places } from './place-pages.data.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const guides = resolve(root, 'guides');
const esc = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const mapUrl = query => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query).replaceAll('%20','+')}`;
const directionsUrl = (destination, origin='') => `https://www.google.com/maps/dir/?api=1&${origin ? `origin=${encodeURIComponent(origin)}&` : ''}destination=${encodeURIComponent(destination)}&travelmode=driving`;
const titleParts = name => { const parts=name.split(' '); const last=parts.pop(); return `${esc(parts.join(' '))} <em>${esc(last)}.</em>`; };
const sourceBlock = place => place.source ? `<p class="source-note">Visitor facts change. Before setting out, check <a href="${esc(place.source)}" target="_blank" rel="noopener">${esc(place.sourceLabel)} ↗</a> alongside live traffic and local conditions.</p>` : `<p class="source-note">Visitor conditions change. Check live traffic and local conditions before setting out.</p>`;
const nearby = place => {
  const candidates = [
    ['gateway-of-india-mumbai.html','South Mumbai classic','Gateway of India','Harbour, history and a natural route into Colaba.'],
    ['fort-kala-ghoda-mumbai.html','Architecture & art','Fort & Kala Ghoda','A walkable heritage district of galleries, museums and cafés.'],
    ['bandra-fort-bandstand-mumbai.html','Closer to BOM','Bandra Fort & Bandstand','Sea Link views, waterfront air and a younger neighbourhood.'],
    ['marine-drive-mumbai.html','Slow down','Marine Drive','Walk the curve, sit by the sea and watch Mumbai change light.'],
    ['juhu-beach-mumbai.html','Western suburbs','Juhu Beach','Sunset, street food and a practical airport-side option.'],
    ['places.html','Keep exploring','All Mumbai places','Search all neighbourhoods, moods and Google Maps links.']
  ];
  return candidates.filter(([href]) => href !== `${place.slug}.html`).slice(0,3);
};

function render(place) {
  const route = place.route.map(([time,title,text],i)=>`<div class="route-stop"><span class="num">Stop ${String(i+1).padStart(2,'0')} · ${esc(time)}</span><h3>${esc(title)}</h3><p>${esc(text)}</p></div>`).join('');
  const options = place.options.map(([time,title,text],i)=>`<div class="time-card${i===1?' featured':''}"><div class="time">${esc(time)}${i===1?' · ideal':''}</div><h3>${esc(title)}</h3><p>${esc(text)}</p></div>`).join('');
  const notes = place.notes.map(([label,text])=>`<div class="field-note"><div class="k">${esc(label)}</div><p>${esc(text)}</p></div>`).join('');
  const related = nearby(place).map(([href,k,title,desc])=>`<a class="related-card" href="${href}"><div class="k">${esc(k)}</div><div class="t">${esc(title)}</div><div class="d">${esc(desc)}</div></a>`).join('');
  const q1=`How long should I spend at ${place.name}?`, a1=`Plan about ${place.time}. The shorter version works when your city window is tight; the longer version lets you combine it with ${place.pair}.`;
  const q2=`Can I visit ${place.name} during a Mumbai airport layover?`, a2=place.layover;
  const destination=place.directionsMap||place.map;
  const map=mapUrl(place.map), directions=directionsUrl(destination), t2=directionsUrl(destination,'Chhatrapati Shivaji Maharaj International Airport Terminal 2'), t1=directionsUrl(destination,'Mumbai Airport Terminal 1');
  return `<!doctype html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${esc(place.title)}</title>
<meta name="description" content="${esc(place.description)}" />
<link rel="canonical" href="https://detourtrips.com/guides/${place.slug}" />
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Cpath d='M16 30 C 10 22 6 18 6 13 A 10 10 0 1 1 26 13 C 26 18 22 22 16 30 Z' fill='%23C8542A'/%3E%3Ccircle cx='16' cy='13' r='3.6' fill='%23FCF7EA'/%3E%3C/svg%3E">
<meta property="og:type" content="article"><meta property="og:site_name" content="Detour"><meta property="og:title" content="${esc(place.title.replace(' | Detour',''))}"><meta property="og:description" content="${esc(place.description)}"><meta property="og:url" content="https://detourtrips.com/guides/${place.slug}"><meta property="og:image" content="https://detourtrips.com/images/${place.image}"><meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@graph':[{'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'Home',item:'https://detourtrips.com/'},{'@type':'ListItem',position:2,name:'Places to explore',item:'https://detourtrips.com/guides/places'},{'@type':'ListItem',position:3,name:place.name,item:`https://detourtrips.com/guides/${place.slug}`}]},{'@type':'Article',headline:place.title.replace(' | Detour',''),description:place.description,image:`https://detourtrips.com/images/${place.image}`,author:{'@type':'Organization',name:'Detour',url:'https://detourtrips.com'},publisher:{'@type':'Organization',name:'Detour'},datePublished:'2026-08-23',dateModified:'2026-08-23',mainEntityOfPage:`https://detourtrips.com/guides/${place.slug}`,about:{'@type':'Place',name:place.name,address:{'@type':'PostalAddress',addressLocality:'Mumbai',addressRegion:'Maharashtra',addressCountry:'IN'}}},{'@type':'FAQPage',mainEntity:[{'@type':'Question',name:q1,acceptedAnswer:{'@type':'Answer',text:a1}},{'@type':'Question',name:q2,acceptedAnswer:{'@type':'Answer',text:a2}}]}]})}</script>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,600;12..96,700;12..96,800&family=Instrument+Serif:ital@0;1&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet"><link rel="stylesheet" href="../assets/site.css">
<script async src="https://www.googletagmanager.com/gtag/js?id=G-54QYM83DKF"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','G-54QYM83DKF');try{var t=localStorage.getItem('detour-theme');if(t)document.documentElement.setAttribute('data-theme',t)}catch(e){}</script><script src="../assets/utm.js" defer></script>
</head>
<body>
<nav id="nav"><a class="logo" href="../index.html" aria-label="Detour home"><svg width="50" height="40" viewBox="0 0 92 74" aria-hidden="true"><path d="M8 60 C 26 60 34 56 46 50" fill="none" stroke="#0E1929" stroke-width="3.4" stroke-linecap="round" stroke-dasharray="0.5 8"/><circle cx="8" cy="60" r="4.5" fill="#2D7BA9"/><path d="M58 60 C 50 49 43 43 43 33 A 15 15 0 1 1 73 33 C 73 43 66 49 58 60 Z" fill="#C8542A"/><circle cx="58" cy="33" r="5.4" fill="#FCF7EA"/></svg><div><div class="wm">Det<em>ou</em>r</div><div class="tag">Mumbai · BOM</div></div></a><div class="nav-links"><a href="places.html" class="active">Places</a><a href="index.html">All guides</a><a href="complete-mumbai-layover-guide.html">Complete guide</a><a href="8-hour-layover-mumbai.html">8 hours</a><a href="is-mumbai-safe-on-a-layover.html">Safety</a></div><a class="btn-primary place-nav-cta" href="../index.html#board" style="padding:10px 18px;font-size:13.5px;">Request a Detour</a></nav>
<main>
<header class="place-hero"><div class="place-hero-grid"><figure class="place-hero-photo"><img src="../images/${esc(place.image)}" alt="${esc(place.alt)}" fetchpriority="high"><figcaption class="place-photo-note"><span>Detour field note · ${esc(place.number)}</span><span>${esc(place.area)}</span></figcaption></figure><div class="place-hero-copy"><nav class="breadcrumb" aria-label="Breadcrumb"><a href="../index.html">Home</a><span>›</span><a href="places.html">Places</a><span>›</span>${esc(place.name)}</nav><span class="eyebrow">Place ${esc(place.number)} · ${esc(place.area.split(' · ')[0])}</span><h1>${titleParts(place.name)}</h1><p class="lead">${esc(place.lead)}</p><div class="place-actions"><a class="btn-primary" href="${directions}" target="_blank" rel="noopener">Get directions ↗</a><a class="btn-map" href="${map}" target="_blank" rel="noopener">Open in Google Maps ↗</a></div><p class="place-reference">Detour field note · Updated August 2026</p></div></div></header>
<section class="quick-read" aria-label="${esc(place.name)} quick facts"><div class="quick-read-grid"><div class="quick-read-item"><div class="k">Time here</div><div class="v">${esc(place.time)}</div></div><div class="quick-read-item"><div class="k">Best paired with</div><div class="v">${esc(place.pair)}</div></div><div class="quick-read-item"><div class="k">Best time</div><div class="v">${esc(place.best)}</div></div><div class="quick-read-item"><div class="k">From BOM</div><div class="v">${esc(place.airport)}</div></div></div></section>
<div class="place-layout"><article class="place-body">
<section id="why" style="padding:0;"><span class="section-kicker">01 · Why make the detour</span><h2>Why visit ${esc(place.name)}?</h2><p>${esc(place.why)}</p></section>
<!-- PHOTO TODO: replace/add a three-image gallery when the dedicated ${esc(place.name)} shoot is available. -->
<section id="route" style="padding:0;"><span class="section-kicker">02 · A route through the place</span><h2>Spend the time <em>with intention.</em></h2><div class="route-note">${route}</div></section>
<section id="time" style="padding:0;"><span class="section-kicker">03 · Choose your time</span><h2>How long should you <em>stay?</em></h2><div class="time-options">${options}</div></section>
<section id="maps" style="padding:0;"><span class="section-kicker">04 · Maps and directions</span><h2>Let live traffic decide the <em>route.</em></h2><p>Open the exact destination when you are ready to leave. Mumbai travel times move sharply with hour, weather and road conditions, so a static estimate should never decide your airport return.</p><div class="map-panel"><div class="map-visual" aria-hidden="true"><svg class="map-pin" viewBox="0 0 64 78"><path d="M32 74C22 61 10 49 10 31a22 22 0 1 1 44 0c0 18-12 30-22 43z" fill="#C8542A"/><circle cx="32" cy="31" r="8" fill="#FCF7EA"/></svg><span class="map-label">${esc(place.name)}</span></div><div class="map-panel-copy"><div><h3>${esc(place.directionsLabel||place.name)}, Mumbai</h3><p>${esc(place.directionsNote||'Save the place or start turn-by-turn directions from your current location.')}</p></div><a class="btn-primary" href="${directions}" target="_blank" rel="noopener">Directions ↗</a></div></div><div class="airport-links"><a class="airport-link" href="${t2}" target="_blank" rel="noopener">From airport T2 <span>Live route ↗</span></a><a class="airport-link" href="${t1}" target="_blank" rel="noopener">From airport T1 <span>Live route ↗</span></a></div>${sourceBlock(place)}</section>
<section id="notes" style="padding:0;"><span class="section-kicker">05 · Local field notes</span><h2>The details that make it <em>better.</em></h2><div class="field-notes">${notes}</div></section>
<section id="layover" style="padding:0;"><span class="section-kicker">06 · Layover reality</span><h2>Can it fit before your <em>next flight?</em></h2><div class="callout sea"><span class="tag">The honest answer</span><br>${esc(place.layover)}</div><p>Share your arrival and departure first. A Mumbai student can recommend the realistic version, meet you at arrivals and adapt the route around the city on the day. It begins with an inquiry, not a blind booking.</p></section>
<section id="faq" class="place-faq" style="padding:0;"><span class="section-kicker">07 · Quick answers</span><h2>${esc(place.name)} <em>FAQ.</em></h2><h3>${esc(q1)}</h3><p>${esc(a1)}</p><h3>${esc(q2)}</h3><p>${esc(a2)}</p></section>
</article><aside class="place-side" aria-label="Page navigation"><div class="place-side-card"><h4>In this field note</h4><a href="#why">Why visit</a><a href="#route">Walk the route</a><a href="#time">Choose your time</a><a href="#maps">Maps & directions</a><a href="#notes">Local notes</a><a href="#layover">Layover reality</a><a href="#faq">Quick answers</a></div><div class="place-side-card map-side"><h4>Take it with you</h4><p>Open the exact destination and check the live journey before leaving.</p><a href="${map}" target="_blank" rel="noopener">Open Google Maps ↗</a></div></aside></div>
<section style="padding:0 0 80px;"><div class="wrap"><div class="cta-band reveal"><h2>Send us your flight times. We’ll find the <em>right deviation.</em></h2><p>A Mumbai student builds the route around the hours you actually have, then adapts it on the day. Free during early access.</p><a class="btn-primary" href="../index.html#board">Request a Detour →</a></div></div></section>
<section class="related" style="padding-top:0;"><h4>Nearby deviations</h4><div class="related-grid">${related}</div></section>
</main>
<footer><div class="wrap"><div class="foot"><div><a class="logo" href="../index.html"><svg width="46" height="37" viewBox="0 0 92 74" aria-hidden="true"><path d="M8 60 C 26 60 34 56 46 50" fill="none" stroke="#F4EDDD" stroke-width="3.4" stroke-linecap="round" stroke-dasharray="0.5 8"/><circle cx="8" cy="60" r="4.5" fill="#F4C430"/><path d="M58 60 C 50 49 43 43 43 33 A 15 15 0 1 1 73 33 C 73 43 66 49 58 60 Z" fill="#C8542A"/><circle cx="58" cy="33" r="5.4" fill="#F4EDDD"/></svg><div><div class="wm">Det<em>ou</em>r</div><div class="tag" style="color:rgba(244,237,221,.5)">Mumbai · BOM</div></div></a><p>Detour helps international travellers experience cities through verified local students. Mumbai is our first home.</p></div><div><h5>Explore</h5><a href="places.html">All places</a><a href="gateway-of-india-mumbai.html">Gateway of India</a><a href="index.html">All guides</a></div><div><h5>Practical</h5><a href="complete-mumbai-layover-guide.html">Complete guide</a><a href="mumbai-layover-visa.html">Visa</a><a href="is-mumbai-safe-on-a-layover.html">Safety</a></div><div><h5>Connect</h5><a href="https://www.instagram.com/detour_trips/" target="_blank" rel="noopener">Instagram</a><a href="mailto:admin@detourtrips.com">admin@detourtrips.com</a></div></div><div class="foot-legal"><div>© 2026 Detour · Made in Mumbai with a lot of cutting chai.</div><div><a href="../index.html">Home</a></div></div></div></footer>
<script>var nav=document.getElementById('nav');function onScroll(){nav.classList.toggle('scrolled',window.scrollY>30)}window.addEventListener('scroll',onScroll,{passive:true});onScroll();var io=new IntersectionObserver(function(entries){entries.forEach(function(e){if(e.isIntersecting)e.target.classList.add('in')})},{threshold:.12});document.querySelectorAll('.reveal').forEach(function(el){io.observe(el)});</script>
</body></html>`;
}

for (const place of places) await writeFile(resolve(guides, `${place.slug}.html`), render(place));

let directory = await readFile(resolve(guides, 'places.html'), 'utf8');
for (const place of places) {
  const display = esc(place.name);
  const pattern = new RegExp(`(<article class="place-directory-card"[\\s\\S]*?<h2>${display.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}<\\/h2>[\\s\\S]*?<\\/article>)`);
  directory = directory.replace(pattern, article => article
    .replace(/class="place-directory-status">Field note (?:planned|next)/, 'class="place-directory-status live">Field note live')
    .replace('<div class="place-directory-actions"><span class="coming-label">Full guide planned</span>', `<div class="place-directory-actions"><a class="field-note-link" href="${place.slug}.html">Read the field note →</a>`));
}
await writeFile(resolve(guides, 'places.html'), directory);
console.log(`Generated ${places.length} SEO place field notes and updated the directory.`);
