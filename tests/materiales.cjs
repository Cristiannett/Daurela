const fs=require('fs'),Module=require('module'),assert=require('node:assert/strict'),path=require('path');
const file=path.join(process.cwd(),'tests/workflow.cjs');let source=fs.readFileSync(file,'utf8');source=source.slice(0,source.lastIndexOf('main().catch'))+';module.exports=fixture;';const mod=new Module(file);mod._compile(source,file);const f=mod.exports(),c=f.ctx;
c.editarMaterial();for(const [k,v] of Object.entries({nombre:'Bolsas Lisboa · grandes',categoria:'Bolsas de plástico',paquete:'500',minimo:'500',inicial:'2380',notas:'Proveedor de prueba'}))f.els.get('mat-'+k).value=v;
c.guardarMaterial();let m=c.loadMateriales()[0];assert.equal(c.stockMaterial(m),2380);c.moverMaterial(m.id,-500,'Mamoud');m=c.loadMateriales()[0];assert.equal(c.stockMaterial(m),1880);assert.equal(c.bajosMateriales().length,0);
assert.throws(()=>c.aplicarMovimientoMaterial(m,-2000,'Error'));assert.throws(()=>c.aplicarMovimientoMaterial(m,0,'Error'));assert.throws(()=>c.aplicarMovimientoMaterial(m,1.2,'Error'));
c.moverMaterial(m.id,-1380,'Retirada');assert.equal(c.bajosMateriales().length,1);c.actualizarBadges();assert.equal(f.els.get('badge-materiales').textContent,'1');
c.moverMaterial(m.id,500,'Entrada');assert.equal(c.bajosMateriales().length,0);
const backup={version:3,...c.datosTaller()};assert.deepEqual(JSON.parse(JSON.stringify(c.validarCopia(backup).materiales)),JSON.parse(JSON.stringify(c.loadMateriales())));
c.aplicarDatos({materiales:[]});c.aplicarDatos(c.validarCopia(backup));assert.equal(c.stockMaterial(c.loadMateriales()[0]),1000);
c.editarMaterial(m.id);c.moverMaterial(m.id,-1,'Otro dispositivo');f.els.get('mat-nombre').value='Nombre obsoleto';c.guardarMaterial();assert.notEqual(c.loadMateriales()[0].nombre,'Nombre obsoleto');
const base=c.loadMateriales()[0],a=c.aplicarMovimientoMaterial(base,-100,'A'),b=c.aplicarMovimientoMaterial(base,-200,'B');const merged=c.mezclarTres(base,a,b,[],'material');assert.equal(c.stockMaterial(merged),699);
const bad=JSON.parse(JSON.stringify(backup));bad.materiales[0].movimientos[0].cantidad='2380';assert.throws(()=>c.validarCopia(bad));
const old={...backup};delete old.materiales;assert.doesNotThrow(()=>c.validarCopia(old));
console.log('OK materiales: quantities, insufficient stock, threshold, refill, backup, old backups, stale edits and concurrent movements.');

const pack=mod.exports(),pc=pack.ctx;
pc.aplicarDatos({materiales:[{id:'pack',nombre:'Bolsas',categoria:'Bolsas',paquete:500,minimo:200,notas:'',movimientos:[{id:'initial',cantidad:2380,nota:'Inicial',fecha:'2026-09-30T10:00:00Z'}]}]});
pc.renderMateriales();const card=pack.els.get('mat-lista').children[0];const controls=card.children.find(x=>x.children.some(y=>y.className==='mat-movement'));const withdrawal=controls.children[1];withdrawal.children[1].value='1';withdrawal.children[2].value='packs';withdrawal.children[3].value='Mamoud';withdrawal.children[4].click();assert.equal(pc.stockMaterial(pc.loadMateriales()[0]),1880);assert.match(pc.loadMateriales()[0].movimientos[1].nota,/Mamoud/);
console.log('OK one-package withdrawal through rendered controls.');
