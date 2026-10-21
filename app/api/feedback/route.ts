import {env} from 'cloudflare:workers';
import {owner} from '@/lib/server-data';
import {z} from 'zod';
const schema=z.object({companyId:z.string().regex(/^U_\d+$/),newsId:z.string().max(120),verdict:z.enum(['useful','irrelevant','saved','hidden'])});
export async function POST(request:Request){
 try{const p=schema.parse(await request.json());if(!env.DB)throw Error();
 await env.DB.prepare('INSERT INTO feedback(user_id,company_id,news_id,verdict,created_at) VALUES(?,?,?,?,?)').bind(owner(request),p.companyId,p.newsId,p.verdict,Date.now()).run();
 return Response.json({ok:true});}catch{return Response.json({error:'Не удалось сохранить обратную связь.'},{status:400});}
}
