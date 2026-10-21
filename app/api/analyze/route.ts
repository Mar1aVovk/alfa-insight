import {analyze,inputSchema} from '@/lib/agent';
import {getNews} from '@/lib/news';
import {ZodError} from 'zod';
export async function POST(request:Request){
 try{
  const input=inputSchema.parse(await request.json());const feed=await getNews(request);const news=feed.items.find(n=>n.id===input.newsId);
  if(!news)return Response.json({error:'Событие не найдено. Обновите ленту.'},{status:404});
  if(new URL(request.url).searchParams.get('format')==='json')return Response.json(await analyze(request,input,news));
  const encoder=new TextEncoder();
  const stream=new ReadableStream({async start(controller){
   const send=(event:string,data:unknown)=>controller.enqueue(encoder.encode('event: '+event+'\ndata: '+JSON.stringify(data)+'\n\n'));
   try{const result=await analyze(request,input,news,trace=>send('step',trace));send('result',result);}
   catch(e){send('error',{error:e instanceof Error?e.message:'Не удалось подготовить разбор.'});}
   finally{controller.close();}
  }});
  return new Response(stream,{headers:{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache'}});
 }catch(e){
  if(e instanceof ZodError)return Response.json({error:'Модель или запрос не соответствуют ожидаемой структуре. Попробуйте другой материал.',issues:e.issues.slice(0,10).map(i=>({path:i.path.join('.'),code:i.code}))},{status:422});
  return Response.json({error:e instanceof Error?e.message:'Не удалось подготовить разбор.'},{status:502});
 }
}
