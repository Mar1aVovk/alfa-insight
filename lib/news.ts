import type {News} from './types';
import {asset,cache,cached} from './server-data';

export const feeds=[
 {name:'Банк России',url:'https://www.cbr.ru/rss/RssPress'},
 {name:'РБК',url:'https://rssexport.rbc.ru/rbcnews/news/30/full.rss'},
 {name:'Интерфакс',url:'https://www.interfax.ru/rss.asp'},
];
function clean(s:string){return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();}
export function parseFeed(xml:string,source:string,feedUrl:string):News[]{
 const items=[...xml.slice(0,1800000).matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)];
 const value=(body:string,tag:string)=>body.match(new RegExp('<'+tag+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+tag+'>','i'))?.[1]??'';
 return items.map(([,body])=>{
  const title=clean(value(body,'title')).slice(0,350),url=clean(value(body,'link'));
  const rawdate=clean(value(body,'pubDate'));const date=new Date(rawdate);
  let n=2166136261;for(const c of url)n=Math.imul(n^c.charCodeAt(0),16777619);
  return {id:'rss_'+(n>>>0).toString(16),title,body:clean(value(body,'description')).slice(0,3500),url,
   source,publishedAt:isNaN(date.getTime())?null:date.toISOString(),feedUrl,origin:'rss' as const,contentScope:'rss_excerpt'};
 }).filter(n=>n.title&&n.url.startsWith('https://'));
}
export type FeedResult={items:News[];updatedAt:string;sources:{name:string;url:string;ok:boolean;count:number}[];fallback:boolean};
export async function getNews(request:Request,force=false):Promise<FeedResult>{
 if(!force){const previous=await cached<FeedResult>('feed:latest');if(previous)return previous;}
 const results=await Promise.allSettled(feeds.map(async f=>{
  const response=await fetch(f.url,{headers:{'User-Agent':'AlfaInsightHackathon/0.1'},signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw Error('RSS недоступен');
  return parseFeed(await response.text(),f.name,f.url);
 }));
 const items:News[]=[];const sources=results.map((r,i)=>{
  if(r.status==='fulfilled')items.push(...r.value);
  return {...feeds[i],ok:r.status==='fulfilled',count:r.status==='fulfilled'?r.value.length:0};
 });
 let fallback=false;
 if(!items.length){const previous=await cached<FeedResult>('feed:last-good');if(previous)return {...previous,fallback:true,sources};
  const seed=await asset<{items:News[];capturedAt:string}>(request,'news-seed.json');items.push(...seed.items);fallback=true;
 }
 const unique=[...new Map(items.map(n=>[n.url,n])).values()];
 const extras=await cached<News[]>('feed:user-items')??[];
 const result={items:[...extras,...unique].slice(0,200),sources,updatedAt:new Date().toISOString(),fallback};
 await cache('feed:latest',result,900000);
 if(!fallback)await cache('feed:last-good',result,7*86400000);
 return result;
}
