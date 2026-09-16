import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const code=await readFile(new URL('../public/assets/booking.js',import.meta.url),'utf8');
function setup(responses){
 const calls=[],events=[];
 const window={DetourAnalytics:{track:(...args)=>events.push(args)},DetourUTM:{first:{utm_source:'test',privateValue:'never'}}};
 const context={window,document:{querySelector:s=>s.startsWith('meta')?{getAttribute:()=>'/test-lead'}:s==='.mw-shell'?{}:null,querySelectorAll:()=>[],getElementById:()=>null},location:{pathname:'/'},addEventListener(){},AbortSignal,FormData:class{constructor(form){this.form=form}entries(){return Object.entries(this.form)}},fetch:async(url,options)=>{calls.push({url,payload:JSON.parse(options.body)});const response=responses.shift();if(response instanceof Error)throw response;return {status:response.status,ok:response.status<300,json:async()=>response.body}}};
 vm.runInNewContext(code,context);
 return {submit:window.DetourLeads.submit,calls,events};
}
const form={name:'Preview',email:'test@example.com',arrival:'2026-12-20T22:00:00+05:30',departure:'2026-12-21T06:00:00+05:30',interests:'Sea air',_honey:''};
test('confirmed lead retains IST offsets and attribution without exposing contact details to analytics',async()=>{const s=setup([{status:200,body:{data:{leadId:'test'}}}]);await s.submit(form,'detour');assert.equal(s.calls[0].payload.layover.arrival,form.arrival);assert.equal(s.calls[0].payload.layover.departure,form.departure);assert.equal(s.calls[0].payload.firstAttribution.privateValue,undefined);assert.equal(s.events.length,1);assert.equal(s.events[0][0],'generate_lead');assert.ok(!JSON.stringify(s.events).includes(form.email));});
test('validation rejection cannot fall back and accidentally bypass the server',async()=>{const s=setup([{status:422,body:{error:'invalid'}}]);await assert.rejects(s.submit(form,'detour'));assert.equal(s.calls.length,1);assert.equal(s.events.length,0);});
test('network failure uses fallback without counting a confirmed primary lead',async()=>{const s=setup([new Error('offline'),{status:200,body:{success:true}}]);const result=await s.submit(form,'detour');assert.equal(result.fallback,true);assert.equal(s.calls.length,2);assert.equal(s.events.length,0);});
test('malformed successful response is not treated as a submitted lead',async()=>{const s=setup([{status:200,body:{}}]);await assert.rejects(s.submit(form,'detour'));assert.equal(s.calls.length,1);assert.equal(s.events.length,0);});

test('fallback HTTP success with an explicit failure body is rejected',async()=>{const s=setup([new Error('offline'),{status:200,body:{success:false}}]);await assert.rejects(s.submit(form,'detour'));assert.equal(s.events.length,0);});
test('fallback malformed body cannot show a false success',async()=>{const s=setup([new Error('offline'),{status:200,body:null}]);await assert.rejects(s.submit(form,'detour'));assert.equal(s.events.length,0);});
