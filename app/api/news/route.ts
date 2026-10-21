import {cache,cached,hash} from '@/lib/server-data';
import {z} from 'zod';
import type {News} from '@/lib/types';
const schema=z.object({title:z.string().min(8).max(350),body:z.string().min(30).max(10000),url:z.string().url().refine(s=>s.startsWith('https://')).optional(),publishedAt:z.string().datetime().optional()});
export async function POST(request:Request){
 try{const p=schema.parse(await request.json());const id='user_'+(await hash(p)).slice(0,14);
  const item:News={id,title:p.title,body:p.body,url:p.url??'',source:'Материал пользователя',publishedAt:p.publishedAt??new Date().toISOString(),origin:'user',contentScope:'user_supplied_unverified'};
  const old=await cached<News[]>('feed:user-items')??[];await cache('feed:user-items',[item,...old.filter(n=>n.id!==id)].slice(0,30),7*86400000);await cache('feed:latest',{},-1);
  return Response.json({ok:true,item});
 }catch{return Response.json({error:'Нужны заголовок от 8 символов и текст от 30 символов. Ссылка, если указана, должна начинаться с https://.'},{status:400});}
}
