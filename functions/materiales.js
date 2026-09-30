const {onCall,HttpsError}=require('firebase-functions/v2/https');
const {onDocumentWritten}=require('firebase-functions/v2/firestore');
const {defineSecret}=require('firebase-functions/params');
const {getFirestore}=require('firebase-admin/firestore');
const {createHash}=require('node:crypto');
const webpush=require('web-push');
const keys=defineSecret('MATERIALES_PUSH_20260930');
const hash=s=>createHash('sha256').update(s).digest('hex');
const stock=m=>(m.movimientos||[]).reduce((n,x)=>n+x.cantidad,0);
function bajos(data){return (data.materiales||[]).filter(m=>Number.isSafeInteger(m.minimo)&&Number.isSafeInteger(stock(m))&&stock(m)<=m.minimo);}
function nuevosAvisos(before,after){
  const old=new Map(bajos(before).map(m=>[m.id,m]));
  return bajos(after).filter(m=>!old.has(m.id)||(stock(m)<=0&&stock(old.get(m.id))>0));
}
function validarSuscripcion(s){
  if(!s||typeof s.endpoint!=='string'||s.endpoint.length>2048)throw new HttpsError('invalid-argument','Suscripción no válida');
  let u;try{u=new URL(s.endpoint);}catch(e){throw new HttpsError('invalid-argument','Destino no válido');}
  const hosts=['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com'];
  if(u.protocol!=='https:'||u.port||u.username||u.password||!hosts.includes(u.hostname))throw new HttpsError('invalid-argument','Servicio de avisos no compatible');
  if(!s.keys||!/^[A-Za-z0-9_-]{87}$/.test(s.keys.p256dh)||!/^[A-Za-z0-9_-]{22}$/.test(s.keys.auth))throw new HttpsError('invalid-argument','Claves de suscripción no válidas');
  return {endpoint:s.endpoint,keys:{auth:s.keys.auth,p256dh:s.keys.p256dh}};
}
function payload(materiales){return {title:'Daurela · Reponer material',body:materiales.slice(0,3).map(m=>m.nombre.slice(0,100)+': '+stock(m)+' uds (mínimo '+m.minimo+')').join(' · ')+(materiales.length>3?' · y '+(materiales.length-3)+' más':''),tag:'materiales-bajos'};}
async function enviar(sub,message){
  const k=JSON.parse(keys.value());
  return webpush.sendNotification(sub,JSON.stringify(message),{vapidDetails:{subject:'https://cristiannett.github.io/Daurela/',publicKey:k.publicKey,privateKey:k.privateKey},TTL:86400,timeout:10000});
}
exports.avisosMateriales=onCall({region:"us-central1",secrets:[keys],maxInstances:3},async request=>{
  if(!request.auth)throw new HttpsError('unauthenticated','Inicia sesión');
  const data=request.data||{},db=getFirestore();
  if(data.accion==='clave')return {publicKey:JSON.parse(keys.value()).publicKey};
  const sub=validarSuscripcion(data.suscripcion),ref=db.collection('materialDevices').doc(hash(sub.endpoint));
  if(data.accion==='desactivar'){
    await db.runTransaction(async tx=>{const snap=await tx.get(ref);if(snap.exists&&snap.data().owner===request.auth.uid)tx.delete(ref);});return {ok:true};
  }
  if(data.accion!=='activar')throw new HttpsError('invalid-argument','Acción no válida');
  const notify=await db.runTransaction(async tx=>{
    const old=await tx.get(ref),v=old.exists?old.data():{};
    const should=v.owner!==request.auth.uid||Date.now()-(v.lastTest||0)>60000;
    tx.set(ref,{owner:request.auth.uid,suscripcion:sub,updated:Date.now(),lastTest:should?Date.now():(v.lastTest||0)});
    return should;
  });
  if(notify){
    const doc=await db.collection('usuarios').doc(request.auth.uid).get(),low=bajos(doc.data()||{});
    try{await enviar(sub,low.length?payload(low):{title:'Daurela · Avisos activados',body:'Te avisaremos cuando un material llegue al mínimo que has elegido.',tag:'materiales-prueba'});}
    catch(e){throw new HttpsError('unavailable','No se pudo enviar el aviso de prueba. Vuelve a activar los avisos.');}
  }
  return {ok:true};
});
exports.alertarMateriales=onDocumentWritten({document:'usuarios/{userId}',secrets:[keys],retry:true,maxInstances:3},async event=>{
  if(!event.data||!event.data.after.exists)return;
  const changed=nuevosAvisos(event.data.before.data()||{},event.data.after.data()||{});
  if(!changed.length)return;
  const db=getFirestore(),latest=await event.data.after.ref.get();
  const wanted=new Set(changed.map(m=>m.id)),low=bajos(latest.data()||{}).filter(m=>wanted.has(m.id));
  if(!low.length)return;
  const devices=await db.collection('materialDevices').where('owner','==',event.params.userId).get();
  for(const device of devices.docs){
    const sent=db.collection('materialPushEvents').doc(hash(event.id+device.id));
    if((await sent.get()).exists)continue;
    try{await enviar(validarSuscripcion(device.data().suscripcion),payload(low));await sent.set({at:Date.now()});}
    catch(e){if([404,410].includes(e.statusCode))await device.ref.delete();else throw e;}
  }
});
// Pure helpers for tests, without exporting extra deployed functions.
Object.defineProperty(exports,'testHelpers',{value:{stock,bajos,nuevosAvisos,validarSuscripcion}});
