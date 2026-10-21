"""Compile OCR pages and captured real RSS items into the reproducible starter corpus."""
import argparse
import datetime
import hashlib
import html
import json
import re
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime
from pathlib import Path

p=argparse.ArgumentParser();p.add_argument('--ocr',required=True);p.add_argument('--manifest',required=True)
p.add_argument('--feeds',required=True);p.add_argument('--output',default='public/data');args=p.parse_args()
out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
docs={x['name']:x for x in json.loads(Path(args.manifest).read_text())}
metadata={
 'ALFA-Macro_Insights-Policy_Rate_11Sep.pdf':('Ключевая ставка: пауза и более жёсткая риторика','2026-09-11'),
 'ALFA-7M26.pdf':('Макростатистика 7М26: рынок труда','2026-09-07'),
 'ALFA-consumption.pdf':('Потребление на пике','2026-08-05'),
 'ALFA-macro_stat1H26.pdf':('Макростатистика 1П26: слабый рост','2026-07-31'),
 'Inflation_tracker_02.pdf':('Инфляция 25–31 августа','2026-09-02'),
 'Gold_digest_August26.pdf':('Обзор рынка золота: август 2026','2026-08-31'),
 'FI_Strategy_3Q26_22072026.pdf':('Долговой рынок: тактический взгляд на 3К26','2026-07-22'),
 'Бонд_Бриф_14092026.pdf':('Бонд Бриф: итоги недели','2026-09-14'),
 'ALFA_Russian_Steels_1К21PreviewUpdate_15Apr2021.pdf':('Российская сталь: исторический обзор 1К21','2021-04-15'),
}
pages=[];chunks=[];catalog={}
for f in sorted(Path(args.ocr).glob('*.json')):
 d=json.loads(f.read_text());name=d['filename'];title,date=metadata[name]
 url=docs[name]['source'];docid=d['documentId']
 catalog[docid]={'id':docid,'title':title,'date':date,'url':url,'filename':name,'historical':date<'2026-01-01'}
 text=re.sub(r'[ \t]+',' ',d['text']).strip()
 pages.append({'documentId':docid,'page':d['page'],'text':text})
 if len(text)<150:continue
 # Keep overlap and page boundaries so a citation always points to one page.
 for n,start in enumerate(range(0,len(text),1050)):
  excerpt=text[start:start+1350]
  if len(excerpt)<100:continue
  chunks.append({'id':f'bank_{docid}_p{d["page"]}_{n}','documentId':docid,'title':title,
   'date':date,'url':url,'page':d['page'],'text':excerpt,'historical':date<'2026-01-01','ocr':True})

def clean(t):
 t=re.sub(r'<script[\s\S]*?</script>','',t,flags=re.I)
 return re.sub(r'\s+',' ',html.unescape(re.sub(r'<[^>]+>',' ',t))).strip()
news=[];seen=set()
sources=[('Банк России','https://www.cbr.ru/rss/RssPress'),('РБК','https://rssexport.rbc.ru/rbcnews/news/30/full.rss'),('Интерфакс','https://www.interfax.ru/rss.asp'),('Банк России · данные','https://www.cbr.ru/rss/RssNews')]
for i,(source,feed) in zip([0,1,2,6],sources):
 path=Path(args.feeds)/f'{i}.xml'
 if not path.exists():continue
 for item in ET.fromstring(path.read_bytes()).findall('.//item'):
  title=clean(item.findtext('title') or '');url=(item.findtext('link') or '').strip()
  if not title or not url.startswith('https://') or title.lower() in seen:continue
  seen.add(title.lower())
  body=clean(item.findtext('description') or '')[:3500]
  try:date=parsedate_to_datetime(item.findtext('pubDate')).isoformat()
  except Exception:date=None
  news.append({'id':'news_'+hashlib.sha256(url.encode()).hexdigest()[:14],'title':title,'body':body,
   'url':url,'source':source,'publishedAt':date,'feedUrl':feed,'origin':'rss','contentScope':'rss_excerpt'})
news=sorted(news,key=lambda x:x['publishedAt'] or '',reverse=True)[:120]
write=lambda name,obj:(out/name).write_text(json.dumps(obj,ensure_ascii=False,separators=(',',':')))
write('bank.json',{'documents':list(catalog.values()),'chunks':chunks,'pages':pages})
write('news-seed.json',{'items':news,'capturedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sources':[{'name':n,'url':u} for n,u in sources]})
print(json.dumps({'documents':len(catalog),'pages':len(pages),'chunks':len(chunks),'news':len(news)},ensure_ascii=False))
