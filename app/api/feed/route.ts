import {company} from '@/lib/server-data';
import {getNews} from '@/lib/news';
import {rankFeed} from '@/lib/ranking';
export async function GET(request:Request){
 try{const u=new URL(request.url);const c=await company(request,u.searchParams.get('company')??'U_9250');
  const role=u.searchParams.get('role')==='ceo'?'ceo':'cfo';const data=await getNews(request,u.searchParams.get('refresh')==='1');
  return Response.json({...data,items:rankFeed(data.items,c,role),totalCollected:data.items.length});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'Не удалось обновить события.'},{status:503});}
}
