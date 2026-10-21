import {asset,company} from '@/lib/server-data';
export async function GET(request:Request){
 try{
  const url=new URL(request.url);const id=url.searchParams.get('id');if(id)return Response.json({company:await company(request,id)});
  const q=(url.searchParams.get('q')??'').toLowerCase().trim().slice(0,80);
  if(q.length<2)return Response.json({companies:[]});
  const data=await asset<{industries:Record<string,string>;rows:string[][]}>(request,'search.json');
  const rows=data.rows.filter(r=>r[0].toLowerCase().includes(q)||r[2].toLowerCase().includes(q)||(data.industries[r[1]]??'').toLowerCase().includes(q));
  rows.sort((a,b)=>Number(b[3]==='CLIENT')-Number(a[3]==='CLIENT'));
  return Response.json({companies:rows.slice(0,20).map(r=>({id:r[0],industry:data.industries[r[1]],city:r[2],clientType:r[3]})),total:rows.length});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'Не удалось загрузить компанию.'},{status:404});}
}
