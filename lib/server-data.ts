import {env} from 'cloudflare:workers';
import type {BankCorpus,Company} from './types';

const hot=new Map<string,{at:number;value:unknown}>();
export async function asset<T>(request:Request,path:string):Promise<T>{
 const old=hot.get(path);if(old&&Date.now()-old.at<300000)return old.value as T;
 const url=new URL('/data/'+path,request.url);
 const response=env.ASSETS?await env.ASSETS.fetch(new Request(url)):await fetch(url);
 if(!response.ok)throw new Error('Не удалось загрузить подготовленные данные.');
 const value=await response.json() as T;
 if(path==='bank.json'||path==='search.json'||path==='examples.json'||path==='audit.json')hot.set(path,{at:Date.now(),value});
 return value;
}
export async function company(request:Request,id:string){
 if(!/^U_\d{1,8}$/.test(id))throw new Error('Укажите идентификатор вида U_9250.');
 const bucket=Number(id.slice(2))%128;
 const data=await asset<Record<string,Company>>(request,'companies/'+bucket+'.json');
 if(!data[id])throw new Error('Компания не найдена в предоставленной базе.');
 return data[id];
}
export async function cached<T>(key:string):Promise<T|null>{
 if(!env.DB)return null;
 const row=await env.DB.prepare('SELECT payload FROM insight_cache WHERE key=? AND expires_at>?').bind(key,Date.now()).first<{payload:string}>();
 if(!row)return null;try{return JSON.parse(row.payload) as T;}catch{return null;}
}
export async function cache(key:string,value:unknown,ttl=900000){
 if(!env.DB)throw new Error('Хранилище пока недоступно. Попробуйте позже.');
 await env.DB.prepare('INSERT INTO insight_cache(key,payload,expires_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET payload=excluded.payload,expires_at=excluded.expires_at')
 .bind(key,JSON.stringify(value),Date.now()+ttl).run();
}
export function owner(request:Request){return 'demo-user';}
export async function hash(value:unknown){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value)));return Array.from(new Uint8Array(bytes)).map(x=>x.toString(16).padStart(2,'0')).join('');}
const stop=new Set('это как для при или что есть был было будет года году год банк банка данные также после между более менее через который данной можно могут'.split(' '));
function tokens(s:string){return (s.toLowerCase().match(/[\p{L}\p{N}]+/gu)??[]).filter(t=>t.length>3&&!stop.has(t)).map(t=>t.replace(/(иями|ениях|ение|ения|ости|ами|ями|ого|ему|ыми|ими|ией|ия|ий|ых|ах|ях|ов|ам|ом|ой|ая|ые|ый|ую|ие|ть|а|я|ы|и|е|у)$/u,''));}
export function retrieve(corpus:BankCorpus,query:string,asOf:string|null,limit=4){
 const date=asOf?new Date(asOf).getTime():Date.now();
 const chunks=corpus.chunks.filter(c=>!c.historical&&new Date(c.date).getTime()<=date+86400000);
 const terms=[...new Set(tokens(query))];
 const docs=chunks.map(c=>({c,words:tokens(c.text),title:tokens(c.title)}));
 const df=new Map(terms.map(t=>[t,docs.filter(d=>d.words.includes(t)||d.title.includes(t)).length]));
 const avg=docs.reduce((a,d)=>a+d.words.length,0)/Math.max(1,docs.length);
 const ranked=docs.map(d=>({chunk:d.c,score:terms.reduce((s,t)=>{
  const tf=d.words.filter(x=>x===t).length+3*d.title.filter(x=>x===t).length;
  const idf=Math.log(1+(docs.length-(df.get(t)??0)+.5)/((df.get(t)??0)+.5));
  return s+(tf?idf*tf*2.2/(tf+1.2*(.25+.75*d.words.length/Math.max(1,avg))):0);
 },0)})).filter(d=>d.score>0).sort((a,b)=>b.score-a.score);
 const counts=new Map<string,number>();const selected=[];
 for(const r of ranked){if((counts.get(r.chunk.documentId)??0)>=2)continue;selected.push(r.chunk);counts.set(r.chunk.documentId,(counts.get(r.chunk.documentId)??0)+1);if(selected.length>=limit)break;}
 return selected;
}
