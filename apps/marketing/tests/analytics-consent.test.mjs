import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const source=await readFile(new URL('../public/assets/analytics.js',import.meta.url),'utf8');
test('analytics loads only with consent; mobile starts are detour events and private fields are filtered',()=>{
 const scripts=[],listeners={};const window={};
 const form={id:'mw-form',addEventListener:(name,fn)=>listeners[name]=fn};
 const document={title:'Detour',head:{appendChild:s=>scripts.push(s)},createElement:()=>({}),querySelector:s=>s.includes('meta')?{getAttribute:()=> 'G-54QYM83DKF'}:null,querySelectorAll:s=>s==='form'?[form]:[]};
 vm.runInNewContext(source,{window,document,localStorage:{getItem:()=>null,setItem(){}},location:{origin:'https://detourtrips.com',pathname:'/',search:'?email=private@example.com'},dispatchEvent(){},CustomEvent:class{},addEventListener(){},URL});
 assert.equal(scripts.length,0);
 window.DetourAnalytics.setConsent('granted');assert.equal(scripts.length,1);
 const config=[...window.dataLayer].map(x=>Array.from(x)).find(x=>x[0]==='config');assert.equal(config[2].page_location,'https://detourtrips.com/');
 listeners.input();
 const events=[...window.dataLayer].map(x=>Array.from(x));assert.equal(events.find(x=>x[1]==='form_start')[2].form_type,'detour');
 window.DetourAnalytics.track('booking_form_open',{form_type:'detour',email:'private@example.com',flight:'AI123'});
 assert.ok(!JSON.stringify(window.dataLayer).includes('private@example.com'));assert.ok(!JSON.stringify(window.dataLayer).includes('AI123'));
 window.DetourAnalytics.setConsent('denied');const count=window.dataLayer.length;window.DetourAnalytics.track('generate_lead',{});assert.equal(window.dataLayer.length,count);
});
