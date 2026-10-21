"""Build bounded, reproducible static partitions from the provided CSV files.

Raw files stay outside Git. All aggregates describe only the supplied sample.
"""
import argparse
import collections
import csv
import hashlib
import json
import math
from pathlib import Path

p=argparse.ArgumentParser()
p.add_argument('--input',required=True)
p.add_argument('--output',default='public/data')
args=p.parse_args()
root,out=Path(args.input),Path(args.output)
(out/'companies').mkdir(parents=True,exist_ok=True)

def rows(filename):
    with (root/filename).open(encoding='utf-8-sig',newline='') as f:
        yield from csv.DictReader(f,delimiter=';')
def number(value):
    try:
        n=float(value)
        return n if math.isfinite(n) else None
    except (TypeError,ValueError):return None
def yes(value):return number(value)==1
def write(path,data):path.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')))

raw=list(rows('df_Uid_data_hack.csv'))
byid={}
duplicates=collections.Counter()
for r in raw:
    uid=r['SYNTHETIC_U']
    duplicates[uid]+=1
    if uid not in byid or sum(bool(v) for v in r.values())>sum(bool(v) for v in byid[uid].values()):byid[uid]=r
products={'CL_PRODUCT_RKO_MARK':'rko','CL_PRODUCT_GAR_MARK':'guarantee',
    'CL_PRODUCT_LOA_MARK':'loan','CL_PRODUCT_LEA_MARK':'leasing',
    'CL_PRODUCT_DEP_MARK':'deposit','CL_PRODUCT_ZPP_MARK':'payroll','FACTORING_MARK':'factoring'}
groups=collections.defaultdict(list)
companies={}
for uid,r in byid.items():
    rev=number(r['REVENUE_COMPANY'])
    warnings=[]
    if rev is None or rev<=0 or rev==1000:
        warnings.append('Выручка отсутствует или является технической заглушкой.');rev=None
    if duplicates[uid]>1:warnings.append('Повторяющийся идентификатор: профиль требует проверки.')
    if not r['MAINOKVED_CODE']:warnings.append('Основной вид деятельности неизвестен.')
    c={'id':uid,'industry':r['MAINOKVED_NAME'] or 'Деятельность не указана',
        'okved':r['MAINOKVED_CODE'],'city':r['CITY'],'region':r['REGION'],
        'revenue':rev,'revenueYear':2025,'groupId':r['GROUP_ID'] or None,
        'clientType':r['CL_TYPE'],'employees':r['AMOUNT_WORKERS_FNS_GRADATION'] or r['AMOUNT_WORKERS_SPARK_GRADATION'] or None,
        'stage':r['ECO_MARK_LABEL'],'age':r['COMPANY_AGE_YEARS_GRADATION'],
        'products':[v for k,v in products.items() if yes(r[k])],
        'countries':[x.strip() for x in r['FTS_COUNTRY_NAME'].split(',') if x.strip()],
        'hasFts':yes(r['FTS_FLAG']),'hasVerifiedOwner':yes(r['NEGATIVEMARK']),
        'warnings':warnings}
    companies[uid]=c
    if c['groupId']:groups[c['groupId']].append(uid)

agg=collections.defaultdict(lambda:{'incoming':0,'outgoing':0,'incomingCount':0,'outgoingCount':0,
    'self':0,'selfCount':0,'knownIncoming':0,'knownOutgoing':0,'edges':[]})
paymentRows=0;total=0;selfAmount=0;selfCount=0;totalCount=0;unknownEdges=0
for r in rows('df_Uid_payment_hack.csv'):
    payer,beneficiary=r['PAYER'],r['BENEFICIARY']
    amount=number(r['PAY_AMT']);count=number(r['PAY_CNT'])
    if amount is None or amount<0 or count is None or count<0:continue
    paymentRows+=1;total+=amount;totalCount+=count
    if payer==beneficiary:
        selfAmount+=amount;selfCount+=count
        if payer in companies:agg[payer]['self']+=amount;agg[payer]['selfCount']+=count
        continue
    unknownEdges+=int(payer not in companies or beneficiary not in companies)
    for uid,other,direction in [(payer,beneficiary,'outgoing'),(beneficiary,payer,'incoming')]:
        if uid not in companies:continue
        a=agg[uid];a[direction]+=amount;a[direction+'Count']+=count
        if other in companies:a['known'+direction.title()]+=amount
        edge={'id':other,'amount':amount,'count':int(count),'direction':direction,
            'known':other in companies,'industry':companies.get(other,{}).get('industry'),
            'sameGroup':bool(companies[uid]['groupId'] and companies.get(other,{}).get('groupId')==companies[uid]['groupId'])}
        a['edges'].append(edge)
        if len(a['edges'])>16:a['edges']=sorted(a['edges'],key=lambda x:x['amount'],reverse=True)[:8]

people=collections.Counter(r['SYNTHETIC_U'] for r in rows('df_Fid_Uid_link_hack.csv'))
for uid,c in companies.items():
    members=groups.get(c['groupId'],[uid])
    industries=collections.Counter(companies[x]['industry'] for x in members)
    revenues=[companies[x]['revenue'] for x in members if companies[x]['revenue'] is not None]
    c['group']={'id':c['groupId'],'size':len(members),'industries':[x for x,n in industries.most_common(5)],
        'memberIds':members[:30], 'reportedRevenueSum':sum(revenues),
        'revenueKnown':len(revenues),'revenueSumIsConsolidated':False}
    c['linkedPeopleCount']=people[uid]
    a=agg.get(uid,{'incoming':0,'outgoing':0,'incomingCount':0,'outgoingCount':0,'self':0,'selfCount':0,'knownIncoming':0,'knownOutgoing':0,'edges':[]})
    a['edges']=sorted(a['edges'],key=lambda e:e['amount'],reverse=True)[:6]
    a['coverageNote']='Только предоставленная выборка. Доля платежей не равна зависимости бизнеса от контрагента.'
    c['payments']=a

buckets=collections.defaultdict(dict)
for uid,c in companies.items():
    bucket=int(uid.split('_')[1])%128
    buckets[bucket][uid]=c
for n,contents in buckets.items():write(out/'companies'/f'{n}.json',contents)

examples=['U_9250','U_182712','U_94669','U_3263','U_204078','U_44792','U_57706','U_102920']
summaries=[{k:companies[uid][k] for k in ['id','industry','okved','city','region','revenue','groupId','products','countries']} for uid in examples if uid in companies]
audit={'rawRows':len(raw),'uniqueCompanies':len(companies),'activeClients':sum(c['clientType']=='CLIENT' for c in companies.values()),
 'groups':len(groups),'duplicateIds':{k:v for k,v in duplicates.items() if v>1},
 'revenuePlaceholders':sum(number(r['REVENUE_COMPANY'])==1000 for r in raw),'paymentRows':paymentRows,
 'paymentAmount':total,'selfTransferAmount':selfAmount,'selfTransferShare':selfAmount/total if total else 0,
 'selfTransferCountShare':selfCount/totalCount if totalCount else 0,'unknownCounterpartyRows':unknownEdges,
 'companyDataPeriod':'2025','paymentsPeriodReportedByOrganizer':'2026-01-01/2026-10-31',
 'dataNotes':['Групповая сумма выручки не является консолидированной: внутригрупповой оборот не исключён.',
 'Направление внешней торговли и роль связанных физлиц не установлены.',
 'Переводы самому себе исключены из анализа контрагентов.']}
write(out/'examples.json',summaries);write(out/'audit.json',audit)
write(out/'search.json',{'industries':{c['okved']:c['industry'] for c in companies.values()},'rows':[[c['id'],c['okved'],c['city'],c['clientType']] for c in companies.values()]})
print(json.dumps(audit,ensure_ascii=False,indent=2))
