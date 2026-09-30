// Run: node tests/workflow.cjs. No network and no real workshop data.
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const cp=require('node:child_process');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
for(const script of scripts){const r=cp.spawnSync(process.execPath,['--input-type=module','--check'],{input:script,encoding:'utf8'});assert.equal(r.status,0,r.stderr);}
const source=scripts.at(-1).slice(0,scripts.at(-1).lastIndexOf('\nload();'));
class Element{
 constructor(tag='div'){this.tagName=tag;this.className='';this.children=[];this.style={};this.dataset={};this.attributes={};this.value='';this.hidden=false;this.classList={add(){},remove(){},contains(){return false;},toggle(){}};this._text='';}
 set textContent(v){this._text=String(v);this.children=[];}get textContent(){return this._text+this.children.map(x=>x.textContent).join(' ');}
 set innerHTML(v){this._text=String(v);this.children=[];}get innerHTML(){return this._text;}
 appendChild(x){this.children.push(x);x.parentNode=this;return x;}append(...xs){xs.forEach(x=>this.appendChild(x));}replaceChildren(...xs){this.children=[];this._text='';this.append(...xs);}
 insertBefore(x,b){this.children.splice(this.children.indexOf(b),0,x);return x;}setAttribute(k,v){this.attributes[k]=String(v);}getAttribute(k){return this.attributes[k];}addEventListener(){}querySelector(){return null;}querySelectorAll(){return [];}remove(){}click(){if(this.onclick)this.onclick();}
}
function fixture(){
 const store=new Map(),els=new Map(),timers=new Map();let timer=0;
 const ctx={console:{log(){},error(){}},setTimeout(fn){timers.set(++timer,fn);return timer;},clearTimeout(id){timers.delete(id);},setInterval(){},clearInterval(){},URL,Blob,TextEncoder,Date,Math,JSON,Map,Set,Number,String,Array,Object,Promise,
 localStorage:{getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)},
 navigator:{onLine:true},history:{pushState(){},replaceState(){}},location:{},confirm:()=>true,alert(){},prompt:()=>null,
 document:{getElementById(id){if(!els.has(id))els.set(id,new Element());return els.get(id);},createElement:t=>new Element(t),querySelector(){return null;},querySelectorAll(){return [];},addEventListener(){},body:new Element('body'),documentElement:new Element('html')},addEventListener(){}};
 ctx.window=ctx;vm.createContext(ctx);vm.runInContext(source,ctx);
 return {ctx,store,els,timers,run:s=>vm.runInContext(s,ctx)};
}
const copy=x=>JSON.parse(JSON.stringify(x));
const empty=()=>({clientes:[],fichajes:{},jornada:6,notas:[],pedidos:[],entregas:[],prep:{},corte:[],inventarios:[],materiales:[],tipos:['Protector','Funda'],fontSize:'md'});
const order=()=>({id:'p1',cliente:'Cliente de prueba',numeroPedido:'DEMO-1',fecha:'2026-09-27',items:[{id:'i1',serie:'Bamboo',tamano:'135',tipo:'Protector',unidades:50,cortadas:20,cajas:5,motivo:''},{id:'i2',serie:'Bamboo',tamano:'135',tipo:'Funda',unidades:10,cortadas:10,cajas:1,motivo:''}]});
let count=0;
function test(name,fn){fn();count++;console.log('OK '+name);}
async function main(){
 const {ctx:c}=fixture();
 const merge=(b,l,r)=>copy(c.mezclarTres(b,l,r,[],''));
 test('independent edits to one record survive',()=>assert.deepEqual(merge({a:1,b:1},{a:2,b:1},{a:1,b:3}),{a:2,b:3}));
 test('remote deletion is not resurrected',()=>assert.deepEqual(merge([{id:'a'}],[{id:'a'}],[]),[]));
 test('local deletion is preserved',()=>assert.deepEqual(merge([{id:'a'}],[],[{id:'a'}]),[]));
 test('simultaneous additions survive',()=>assert.deepEqual(merge([],[{id:'a'}],[{id:'b'}]),[{id:'a'},{id:'b'}]));
 test('remote quantity updates reach existing orders',()=>assert.deepEqual(merge([{id:'a',n:1}],[{id:'a',n:1}],[{id:'a',n:52}]),[{id:'a',n:52}]));
 test('conflicting values are explicitly reported',()=>{const conflicts=[];assert.equal(c.mezclarTres(1,2,3,conflicts,'x'),2);assert.deepEqual(conflicts,['x']);});
 test('first sync prefers cloud on conflicts',()=>assert.equal(c.mezclarTres(undefined,2,3,[],'x'),3));
 test('backup round trip covers all sections',()=>{const data=empty();data.corte=[order()];data.fichajes={'2025-01-01':{norm:6,extra:2}};data.prep={demo:'Etiquetas'};data.inventarios=[{mesKey:'2026-09',zonas:{demo:{telas:[{nombre:'Tela',metros:'1 palet y medio'}]}}}];c.aplicarDatos(data);assert.deepEqual(copy(c.validarCopia({version:3,...data})),data);assert.deepEqual(copy(c.datosTaller()),data);});
 test('legacy backup preserves newer sections',()=>{c.aplicarDatos(c.validarCopia({version:2,clientes:[],notas:[]}));assert.equal(c.loadCorte().length,1);});
 test('invalid backups rejected before writes',()=>{assert.throws(()=>c.validarCopia({version:3,clientes:[]}));assert.throws(()=>c.validarCopia({clientes:[null]}));});
 test('category and size remain separate',()=>{c.aplicarDatos({...empty(),corte:[order()]});const info=c.corteRestantePorTamano(order(),'Mercedes','Bamboo',order().items);assert.equal(info.restante[c.claveCorteEntrega('135','Protector')],20);assert.equal(info.restante[c.claveCorteEntrega('135','Funda')],10);});
 test('partial sending retains categories and order number',()=>{c.enviarCorteAEntregas('p1','Mercedes','Bamboo',{[c.claveCorteEntrega('135','Funda')]:4});const ent=c.loadEntregas()[0];assert.equal(ent.lineas[0].tipo,'Funda');assert.equal(ent.lineas[0].uds,'4');assert.equal(ent.origenCorte.numeroPedido,'DEMO-1');const info=c.corteRestantePorTamano(order(),'Mercedes','Bamboo',order().items);assert.equal(info.restante[c.claveCorteEntrega('135','Funda')],6);assert.equal(info.restante[c.claveCorteEntrega('135','Protector')],20);});
 test('duplicate stale send cannot exceed remaining',()=>{c.enviarCorteAEntregas('p1','Mercedes','Bamboo',{[c.claveCorteEntrega('135','Funda')]:10});assert.equal(c.loadEntregas().length,1);});
 test('ambiguous historical shipment blocks further sending',()=>{c.aplicarDatos({entregas:[{id:'e',conf:'Mercedes',origenCorte:{pedidoId:'p1',serie:'Bamboo'},lineas:[{talla:'135',uds:'4'}]}]});assert.equal(c.corteRestantePorTamano(order(),'Mercedes','Bamboo',order().items).ambiguo,true);});
 test('completed rows fold in work mode and counter excludes them',()=>{const f=fixture();f.ctx.aplicarDatos({...empty(),corte:[order()]});f.run("corteDetalleId='p1';modoTrabajoCorte=true;");f.ctx.renderCorteDetalle();const body=f.els.get('corte-detalle-body');assert.equal(body.children.at(-1).tagName,'details');assert.match(body.children.at(-1).textContent,/Lineas terminadas \(1\)/);f.ctx.actualizarBadges();assert.equal(f.els.get('badge-corte').textContent,'1');});
 test('overcutting and undo restore only the affected line',()=>{const f=fixture();f.ctx.aplicarDatos({...empty(),corte:[order()]});f.run("corteDetalleId='p1';");f.ctx.agregarCortadas('p1','i1',32);assert.equal(f.ctx.loadCorte()[0].items[0].cortadas,52);const panel=f.els.get('undo-panel');panel.children[1].click();assert.equal(f.ctx.loadCorte()[0].items[0].cortadas,20);});

 test('shipment undo removes only the generated shipment',()=>{const f=fixture();f.ctx.aplicarDatos({...empty(),corte:[order()]});f.ctx.enviarCorteAEntregas('p1','Mercedes','Bamboo',{[f.ctx.claveCorteEntrega('135','Funda')]:4});assert.equal(f.ctx.loadEntregas().length,1);f.els.get('undo-panel').children[1].click();assert.equal(f.ctx.loadEntregas().length,0);});
 test('undo refuses to overwrite a newer cut',()=>{const f=fixture();f.ctx.aplicarDatos({...empty(),corte:[order()]});f.ctx.agregarCortadas('p1','i1',5);const rows=f.ctx.loadCorte();rows[0].items[0].cortadas=33;f.ctx.aplicarDatos({corte:rows});f.els.get('undo-panel').children[1].click();assert.equal(f.ctx.loadCorte()[0].items[0].cortadas,33);});
 test('malformed nested backup rejected',()=>{assert.throws(()=>c.validarCopia({...empty(),version:3,notas:[null]}));assert.throws(()=>c.validarCopia({...empty(),version:3,tipos:[{}]}));assert.throws(()=>c.validarCopia({...empty(),version:3,inventarios:[{mesKey:'x',zonas:{x:null}}]}));});
 test('failed storage write rolls back imported sections',()=>{const f=fixture();const data=empty();data.corte=[order()];f.ctx.aplicarDatos(data);const original=f.ctx.localStorage.setItem;let failed=false;f.ctx.localStorage.setItem=(k,v)=>{if(k==='corte_v1'&&!failed){failed=true;throw Error('Quota');}original(k,v);};assert.throws(()=>f.ctx.aplicarDatos({...empty(),jornada:8}));assert.deepEqual(copy(f.ctx.datosTaller()),data);});
 // Actual transaction integration with synthetic Firestore, no network.
 const f=fixture();const data=empty();data.corte=[order()];f.ctx.aplicarDatos(data);let cloud=copy(data),writes=0;
 f.ctx._fireUser={uid:'test'};f.ctx._fireDB={};
 f.ctx._fireFns={doc:()=>({}),runTransaction:async(db,fn)=>fn({get:async()=>({exists:()=>true,data:()=>copy(cloud)}),set:(ref,value)=>{cloud=copy(value);writes++;}})};
 await f.ctx.syncFirestore();test('initial transaction establishes baseline',()=>assert.equal(JSON.parse(f.store.get('daurela_sync_v3')).owner,'test'));
 cloud.corte[0].items[0].cortadas=30;cloud.ts=10;await f.ctx.syncFirestore();test('remote transaction updates local cutting quantity',()=>assert.equal(f.ctx.loadCorte()[0].items[0].cortadas,30));
 cloud.corte=[];cloud.ts=11;await f.ctx.syncFirestore();test('remote transaction deletion persists',()=>assert.equal(f.ctx.loadCorte().length,0));
 f.ctx.navigator.onLine=false;f.ctx.aplicarDatos({corte:[order()]});const before=writes;await f.ctx.syncFirestore();test('offline save stays local and makes no write',()=>{assert.equal(writes,before);assert.equal(f.ctx.loadCorte().length,1);});
 f.ctx.navigator.onLine=true;await f.ctx.syncFirestore();test('reconnection uploads pending edits',()=>assert.equal(cloud.corte.length,1));
 f.ctx._fireFns.runTransaction=async(db,fn)=>{const result=await fn({get:async()=>({exists:()=>true,data:()=>copy(cloud)}),set:(ref,value)=>{cloud=copy(value);}});const live=f.ctx.loadCorte();live[0].items[0].cortadas=42;f.ctx.aplicarDatos({corte:live});return result;};
 await f.ctx.syncFirestore();test('edits during request are preserved locally',()=>assert.equal(f.ctx.loadCorte()[0].items[0].cortadas,42));
 f.ctx._fireUser={uid:'other'};await f.ctx.syncFirestore();test('different account cannot receive local data',()=>assert.equal(JSON.parse(f.store.get('daurela_sync_v3')).owner,'test'));

 const errors=fixture();errors.ctx.aplicarDatos({...empty(),corte:[order()]});errors.ctx._fireUser={uid:'test'};errors.ctx._fireDB={};errors.ctx._fireFns={doc:()=>({}),runTransaction:async()=>{throw Error('offline');}};await errors.ctx.syncFirestore();test('failed cloud request keeps local data and no success timestamp',()=>{assert.equal(errors.ctx.loadCorte().length,1);assert.equal(errors.store.has('daurela_sync_v3'),false);assert.match(errors.els.get('sync-txt').textContent,/Error/);});
 const conflict=fixture();const base=empty();base.corte=[order()];conflict.ctx.aplicarDatos(base);conflict.store.set('daurela_sync_v3',JSON.stringify({owner:'test',base,at:1}));const local=copy(base);local.corte[0].items[0].cortadas=25;conflict.ctx.aplicarDatos(local);const remote=copy(base);remote.corte[0].items[0].cortadas=30;conflict.ctx._fireUser={uid:'test'};conflict.ctx._fireDB={};conflict.ctx._fireFns={doc:()=>({}),runTransaction:async(db,fn)=>fn({get:async()=>({exists:()=>true,data:()=>remote}),set(){}})};await conflict.ctx.syncFirestore();test('conflict creates recoverable local and cloud copies',()=>{const recovery=JSON.parse(conflict.store.get('daurela_recuperacion_v3'));assert.equal(recovery.corte[0].items[0].cortadas,25);assert.equal(recovery.alternativaNube.corte[0].items[0].cortadas,30);});

 test('full application startup with simulated DOM',()=>{const boot=fixture();boot.ctx.fetch=async()=>{throw Error('No network');};boot.run(scripts.at(-1).slice(scripts.at(-1).lastIndexOf('\nload();')));});
 console.log(count+' checks passed.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
