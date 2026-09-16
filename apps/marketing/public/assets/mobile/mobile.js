(() => {
  'use strict';
  const shell = document.querySelector('.mw-shell');
  if (!shell) return;
  const $ = id => document.getElementById(id);
  const media = matchMedia('(max-width: 767px)');
  const storageKey = 'detour-mobile-plan-v1';
  const names = JSON.parse(shell.dataset.mwPlaces);
  const moods = {coast:['Sea & slow moments','A little city, a little sea','A waterfront pause and time to slow down.'],food:['Chai & local bites','Follow the chai','A café pause and local flavours, shaped around you.'],culture:['Streets & stories','Streets with soul','Architecture and everyday stories, with time to look around.']};
  let state = {hours:8,mood:'coast',places:[],fields:{},checks:[]};
  // Session storage is local to this browser tab. No analytics or backend draft writes.
  try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
    if (saved && Date.now()-saved.updated < 12*60*60*1000) {
      state.hours=[6,8,12].includes(saved.hours)?saved.hours:8;
      state.mood=Object.hasOwn(moods,saved.mood)?saved.mood:'coast';
      state.places=Array.isArray(saved.places)?saved.places.filter(s=>names.some(p=>p.slug===s)):[];
      state.fields=saved.fields && typeof saved.fields==='object'?saved.fields:{};
      state.checks=Array.isArray(saved.checks)?saved.checks.filter(c=>['entry','flight','bags'].includes(c)):[];
    } else if(saved) sessionStorage.removeItem(storageKey);
  } catch {}
  document.querySelector('[data-mw-consent]').addEventListener('click',()=>document.querySelector('[data-consent-manage]')?.click());
  const fieldIds=['mw-name','mw-email','mw-arrival','mw-departure','mw-flights','mw-notes'];
  fieldIds.forEach(id=>{if(typeof state.fields[id]==='string') $(id).value=state.fields[id]});
  function save(){
    fieldIds.forEach(id=>state.fields[id]=$(id).value);
    document.querySelectorAll('.mw-dock [data-mw-open]').forEach(b=>b.textContent=fieldIds.some(id=>$(id).value)?'Continue my plan':'Plan my detour');
    try { sessionStorage.setItem(storageKey,JSON.stringify({...state,updated:Date.now()})); }
    catch { document.querySelector('[data-mw-storage-note]').textContent='Your browser cannot save this plan between pages. Keep this page open while you plan.'; }
  }
  let toastTimer;
  function toast(message){clearTimeout(toastTimer);$('mw-toast').textContent=message;$('mw-toast').hidden=false;toastTimer=setTimeout(()=>$('mw-toast').hidden=true,3500)}
  function selection(){return `${state.hours===12?'12+':state.hours}-hour starting point · ${moods[state.mood][0]}${state.places.length?' · Saved: '+state.places.map(slug=>names.find(p=>p.slug===slug).name).join(', '):''}`}
  function update(){
    document.querySelectorAll('[data-mw-hours]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.mwHours===state.hours)));
    document.querySelectorAll('[data-mw-mood]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mwMood===state.mood)));
    document.querySelectorAll('[data-mw-place]').forEach(b=>{const p=names.find(p=>p.slug===b.dataset.mwPlace);const on=state.places.includes(p.slug);b.setAttribute('aria-pressed',String(on));b.textContent=on?'Saved ✓':'Save';b.setAttribute('aria-label',`${on?'Remove':'Save'} ${p.name}`)});
    if($('mw-result-title')){
      $('mw-result-label').textContent=state.hours===6?'LET’S CHECK YOUR WINDOW FIRST':'YOUR STARTING POINT';
      $('mw-result-title').textContent=state.hours===6?'Keep it close. Keep it flexible.':moods[state.mood][1];
      $('mw-result-copy').textContent=state.hours===6?'A short window needs a host review before choosing a city route.':moods[state.mood][2];
      $('mw-saved-count').textContent=state.places.length?`${state.places.length} saved place${state.places.length===1?'':'s'} will be included in your request.`:'Save places you like. We’ll include them in your request.';
    }
    document.querySelectorAll('[data-mw-saved-badge]').forEach(b=>b.textContent=String(state.places.length));
    const list=$('mw-saved-list');list.replaceChildren();$('mw-saved-empty').hidden=state.places.length>0;
    state.places.forEach(slug=>{const place=names.find(p=>p.slug===slug);const row=document.createElement('div'),link=document.createElement('a'),remove=document.createElement('button');link.href='/guides/'+slug;link.textContent=place.name;remove.type='button';remove.textContent='Remove';remove.setAttribute('aria-label','Remove '+place.name+' from shortlist');remove.addEventListener('click',()=>{state.places=state.places.filter(p=>p!==slug);update();save();toast(place.name+' removed');(list.querySelector('button')||$('mw-saved').querySelector('[data-mw-close]')).focus()});row.append(link,remove);list.append(row)});
    document.querySelectorAll('[data-mw-check]').forEach(c=>c.checked=state.checks.includes(c.dataset.mwCheck));
    if($('mw-check-progress'))$('mw-check-progress').textContent=state.checks.length+' of 3 preparation steps checked.';
    document.querySelectorAll('.mw-dock [data-mw-open]').forEach(b=>b.textContent=fieldIds.some(id=>$(id).value)?'Continue my plan':'Plan my detour');
    $('mw-selection').textContent=selection();
  }
  document.querySelectorAll('[data-mw-hours]').forEach(b=>b.addEventListener('click',()=>{state.hours=+b.dataset.mwHours;update();save()}));
  document.querySelectorAll('[data-mw-mood]').forEach(b=>b.addEventListener('click',()=>{state.mood=b.dataset.mwMood;update();save()}));
  document.querySelectorAll('[data-mw-place]').forEach(b=>b.addEventListener('click',()=>{const slug=b.dataset.mwPlace;state.places=state.places.includes(slug)?state.places.filter(s=>s!==slug):[...state.places,slug];update();save()}));
  const form=$('mw-form'), inquiry=$('mw-inquiry'), menu=$('mw-menu'), savedDialog=$('mw-saved');
  document.querySelectorAll('[data-mw-saved-open]').forEach(b=>b.addEventListener('click',()=>{menu.close();update();savedDialog.showModal()}));
  document.querySelectorAll('[data-mw-check]').forEach(c=>c.addEventListener('change',()=>{state.checks=c.checked?[...new Set([...state.checks,c.dataset.mwCheck])]:state.checks.filter(x=>x!==c.dataset.mwCheck);update();save()}));
  let reviewing=false, sending=false;
  function edit(){$('mw-form-error').hidden=true;reviewing=false;$('mw-details').hidden=false;$('mw-review').hidden=true;$('mw-edit').hidden=true;$('mw-submit').textContent='Review my request';$('mw-progress').textContent='YOUR DETOUR / STEP 1 OF 2'}
  function open(){if(!media.matches)return;menu.close();savedDialog.close();if(reviewing&&!form.hidden&&!sending)edit();update();inquiry.showModal();$('mw-inquiry-title').focus();window.DetourAnalytics?.track('booking_form_open',{form_type:'detour',page_path:location.pathname});}
  document.querySelectorAll('[data-mw-open]').forEach(b=>b.addEventListener('click',open));
  document.querySelector('[data-mw-menu-open]').addEventListener('click',()=>menu.showModal());
  document.querySelectorAll('[data-mw-close]').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));
  menu.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>menu.close()));
  $('mw-edit').addEventListener('click',()=>{edit();$('mw-name').focus()});
  form.addEventListener('input',()=>{$('mw-form-error').hidden=true;$('mw-departure').setCustomValidity('');$('mw-name').setCustomValidity('');save()});
  function dates(){return [new Date($('mw-arrival').value+':00+05:30'),new Date($('mw-departure').value+':00+05:30')]}
  function friendly(date){return new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Kolkata'}).format(date)+' IST'}
  function error(message){$('mw-form-error').textContent=message;$('mw-form-error').hidden=false;}
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(sending)return;
    if(!reviewing){
      $('mw-departure').setCustomValidity('');
      $('mw-name').value=$('mw-name').value.trim();$('mw-email').value=$('mw-email').value.trim();
      if(!form.reportValidity())return;
      const [arrival,departure]=dates();
      if(!Number.isFinite(+arrival)||!Number.isFinite(+departure)){error('Choose valid arrival and departure dates.');return;}
      if(departure<=arrival){$('mw-departure').setCustomValidity('Departure must be after arrival. Check the date for an overnight layover.');$('mw-departure').reportValidity();return;}
      if(departure<=Date.now()){error('Your departure is in the past. Check the date and Mumbai time.');return;}
      const actualHours=(departure-arrival)/3600000;
      const interests=[moods[state.mood][0],state.places.length?'Saved places: '+state.places.map(s=>names.find(p=>p.slug===s).name).join(', '):'', $('mw-notes').value.trim()].filter(Boolean).join('\n');
      form.elements.arrival.value=$('mw-arrival').value+':00+05:30';form.elements.departure.value=$('mw-departure').value+':00+05:30';form.elements.interests.value=interests;
      const list=$('mw-review-list');list.replaceChildren();
      for(const [label,value] of [['Name',$('mw-name').value],['Email',$('mw-email').value],['Arriving',friendly(arrival)],['Departing',friendly(departure)],['Actual layover',`${Number(actualHours.toFixed(1))} hours · includes airport formalities and travel`],['Flight numbers',$('mw-flights').value||'Not provided'],['Your preferences',interests]]){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;list.append(dt,dd)}
      if(actualHours<8){const p=document.createElement('p');p.className='mw-fine';p.textContent='This is a short window. Your hosts may recommend staying at the airport after reviewing your flight details.';list.append(p)}
      reviewing=true;$('mw-details').hidden=true;$('mw-review').hidden=false;$('mw-edit').hidden=false;$('mw-submit').textContent='Send my request';$('mw-progress').textContent='YOUR DETOUR / STEP 2 OF 2';inquiry.scrollTop=0;$('mw-inquiry-title').focus();save();return;
    }
    sending=true;$('mw-submit').disabled=true;$('mw-edit').disabled=true;form.setAttribute('aria-busy','true');$('mw-submit').textContent='Sending…';$('mw-form-error').hidden=true;
    try {
      if(!window.DetourLeads)throw new Error('Submission unavailable');
      const result=await window.DetourLeads.submit(form,'detour');
      form.hidden=true;$('mw-success').hidden=false;$('mw-progress').textContent='YOUR DETOUR / REQUEST SENT';$('mw-success').focus();
      if(result.fallback)$('mw-success').querySelector('p').textContent='Your request has been emailed to your hosts. They’ll review it and reply by email. Your trip is not confirmed yet.';
      // Clear contact and flight details after a successful send; preferences may remain.
      fieldIds.forEach(id=>$(id).value='');save();
    }catch{error('That did not send. Your details are still here. Try again, or email admin@detourtrips.com.');}
    finally{sending=false;$('mw-submit').disabled=false;$('mw-edit').disabled=false;form.removeAttribute('aria-busy');$('mw-submit').textContent='Send my request';}
  });
  function resetRequest(){form.reset();fieldIds.forEach(id=>$(id).value='');edit();form.hidden=false;$('mw-success').hidden=true;$('mw-form-error').hidden=true;$('mw-inquiry-title').innerHTML='A few details.<br>A better <em>detour.</em>';save();update()}
  $('mw-new-request').addEventListener('click',()=>{resetRequest();$('mw-inquiry-title').focus()});
  document.querySelector('[data-mw-clear]').addEventListener('click',()=>{if(sending){toast('Please wait for your request to finish sending.');return;}state={hours:8,mood:'coast',places:[],fields:{},checks:[]};resetRequest();document.querySelector('.mw-reset').open=false;document.querySelector('.mw-reset summary').focus();toast('Your plan and draft have been cleared.')});
  // Layout follows available width, not a guessed phone model. Changes preserve the draft.
  function syncLayout(){if(media.matches){document.querySelectorAll('.modal-overlay.open').forEach(el=>{el.classList.remove('open');el.setAttribute('aria-hidden','true')});document.body.style.overflow='';}document.documentElement.dataset.presentation=media.matches?'mobile':'desktop';if(!media.matches){inquiry.close();menu.close();savedDialog.close()}document.querySelectorAll('.desktop-home video').forEach(v=>{if(media.matches)v.pause()});}
  addEventListener('pageshow',event=>{if(event.persisted) location.reload()});
  media.addEventListener('change',syncLayout);syncLayout();update();
  // Existing guide links can keep using the desktop homepage inquiry anchor.
  if(media.matches&&['#board','#booking'].includes(location.hash))open();
  // Guide-page request buttons use the same independent mobile planner.
  document.addEventListener('click',event=>{if(!media.matches)return;const b=event.target.closest('.btn-trigger-booking');if(!b)return;event.preventDefault();event.stopImmediatePropagation();open();},true);
})();
