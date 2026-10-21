import {env} from 'cloudflare:workers';
import {asset} from '@/lib/server-data';
import type {BankCorpus,Company} from '@/lib/types';
export async function GET(request:Request){
 const [examples,audit,bank]=await Promise.all([asset<Partial<Company>[]>(request,'examples.json'),asset(request,'audit.json'),asset<BankCorpus>(request,'bank.json')]);
 const usage=env.DB?await env.DB.prepare('SELECT * FROM usage WHERE day=?').bind(new Date().toISOString().slice(0,10)).first():null;
 return Response.json({examples,audit,documents:bank.documents,usage,modelConnected:!!env.LLM_API_KEY,version:'0.1.0',scope:'Рабочая версия первого дня'});
}
