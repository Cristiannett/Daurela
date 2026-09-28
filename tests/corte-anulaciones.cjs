const fs=require('node:fs'),Module=require('node:module'),assert=require('node:assert/strict'),path=require('node:path');
const file=path.join(__dirname,'workflow.cjs');let source=fs.readFileSync(file,'utf8');source=source.slice(0,source.lastIndexOf('main().catch'))+';module.exports=fixture;';const mod=new Module(file);mod._compile(source,file);const f=mod.exports(),c=f.ctx;
const order={id:'cancel-test',cliente:'Prueba',fecha:'2026-09-28',numeroPedido:'45',items:[{id:'a',serie:'Bamboo',tamano:'135',tipo:'Protector',unidades:100,cortadas:20},{id:'b',serie:'Bamboo',tamano:'150',tipo:'Protector',unidades:50,cortadas:0},{id:'c',serie:'Bamboo',tamano:'180',tipo:'Protector',unidades:10,cortadas:10}]};
c.aplicarDatos({corte:[order],entregas:[]});f.run("corteDetalleId='cancel-test';");c.prompt=()=> 'Dos tamaños anulados por el cliente';let count=0;function test(n,fn){fn();count++;console.log('OK '+n);}
c.cambiarAnulacionCorte(order.id,'a',false);
test('cancel only remaining quantity, keep actual cutting',()=>{const i=c.loadCorte()[0].items[0];assert.equal(i.cortadas,20);assert.equal(i.unidades,100);assert.equal(i.anulacion.unidades,80);assert.equal(c.corteLineaCompleta(i),true);assert.equal(c.corteLineaCompleta(c.loadCorte()[0].items[1]),false);});
test('actual cut quantity still available for dispatch',()=>{const p=c.loadCorte()[0];const info=c.corteRestantePorTamano(p,'Mercedes','Bamboo',p.items);assert.equal(info.restante[c.claveCorteEntrega('135','Protector')],20);assert.equal(info.restante[c.claveCorteEntrega('150','Protector')],undefined);});
c.cambiarAnulacionCorte(order.id,null,false);
test('closing order resolves pending without inventing units',()=>{const p=c.loadCorte()[0];assert.ok(p.items.every(c.corteLineaCompleta));assert.equal(p.items[1].cortadas,0);assert.equal(p.items[2].anulacion,undefined);c.actualizarBadges();assert.equal(f.els.get('badge-corte').style.display,'none');});
test('completed tab distinguishes cancellation',()=>{f.run("filtroCorteActual='completados';");c.renderCorte();assert.match(f.els.get('lst-corte').textContent,/Cerrado con anulaciones/);assert.match(f.els.get('corte-detalle-body').textContent,/80 uds anuladas/);});
test('cancelled rows refuse additional cutting',()=>{c.agregarCortadas(order.id,'a',10);assert.equal(c.loadCorte()[0].items[0].cortadas,20);});
test('cancellation survives backup and synchronization payload',()=>{const data=c.datosTaller();const valid=c.validarCopia(JSON.parse(JSON.stringify({...data,version:3})));assert.equal(valid.corte[0].items[0].anulacion.unidades,80);});
c.cambiarAnulacionCorte(order.id,'a',true);
test('reopen restores original outstanding quantity',()=>{const i=c.loadCorte()[0].items[0];assert.equal(i.anulacion,undefined);assert.equal(i.cortadas,20);assert.equal(c.corteLineaCompleta(i),false);c.actualizarBadges();assert.equal(f.els.get('badge-corte').textContent,'1');});
test('cancelled prompt makes no change',()=>{const before=JSON.stringify(c.loadCorte());c.prompt=()=>null;c.cambiarAnulacionCorte(order.id,'a',false);assert.equal(JSON.stringify(c.loadCorte()),before);});
test('all cancelled lines can reopen without resetting finished line',()=>{c.cambiarAnulacionCorte(order.id,null,true);const p=c.loadCorte()[0];assert.ok(p.items.every(i=>!i.anulacion));assert.equal(p.items[2].cortadas,10);});
console.log(count+' cancellation checks passed.');
