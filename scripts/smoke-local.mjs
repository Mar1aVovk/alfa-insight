import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
const port=process.env.SMOKE_PORT??'3107';
const child=spawn(process.execPath,['scripts/start.mjs'],{env:{...process.env,PORT:port},stdio:['ignore','pipe','pipe']});
let log='';
try{
 await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error('Runtime startup timed out. '+log.slice(-1500))),60000);
  const collect=chunk=>{log+=chunk.toString();if(log.includes('Ready on http://')){clearTimeout(timer);resolve();}};
  child.stdout.on('data',collect);child.stderr.on('data',collect);
  child.once('exit',code=>{clearTimeout(timer);reject(Error('Runtime exited with code '+code+'. '+log.slice(-1500)));});
 });
 const origin='http://127.0.0.1:'+port;
 for(const path of ['/','/api/bootstrap','/api/companies?id=U_9250','/api/companies?q=U_182712']){
  const r=await fetch(origin+path,{signal:AbortSignal.timeout(20000)});assert.equal(r.status,200,path);
  if(path==='/'){assert.ok((await r.text()).includes('Альфа'));}
  else{
   const d=await r.json();
   if(path==='/api/bootstrap'){assert.equal(d.audit.uniqueCompanies,85514);assert.equal(d.documents.length,9);}
   if(path.includes('id='))assert.equal(d.company.id,'U_9250');
   if(path.includes('q='))assert.ok(d.companies.some(c=>c.id==='U_182712'));
  }
  console.log('PASS local '+path);
 }
 const invalid=await fetch(origin+'/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
 assert.equal(invalid.status,422);console.log('PASS invalid analysis request rejected before inference');
 console.log('Standalone runtime smoke checks passed. No LLM inference requested.');
}finally{child.kill('SIGTERM');}
