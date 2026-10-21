import type {Company,News,RankedNews,Role} from './types';
export const patterns = {
 rates:/ключев[а-яё]* став|процентн[а-яё]* став|денежно.кредит|стоимост[а-яё]* кредит|рефинансир|доходност[а-яё]* (?:облигац|офз)|депозит/iu,
 inflation:/инфляц|рост[а-яё]* цен|подорож|индекс[а-яё]* цен/iu,
 metals:/металл|сталь|прокат|руд[а-яё]*|алюмин|мед[ьиь]/iu,
 fuel:/нефт|бензин|дизел|топлив|нефтепродукт|газов/iu,
 trade:/тамож|пошлин|санкци|экспорт|импорт|внешн[а-яё]* торгов/iu,
 labor:/рын[а-яё]* труда|зарплат|заработн|безработ|кадр[а-яё]*|ваканс/iu,
 demand:/потреблен|розничн|ввп|спрос|промышленн[а-яё]* производ/iu,
 logistics:/логист|перевоз|транспортн|фрахт|грузопоток|морск[а-яё]* порт|портов[а-яё]*|судоход/iu,
 tech:/кибератак|информационн[а-яё]* безопас|полупровод|программного обеспечения|цифровизац/iu,
 construction:/строитель|ипотек|недвижим|жиль[еяё]|инфраструктур/iu,
 regulation:/налог|(?<![а-яё])ндс(?![а-яё])|регулирован|законопроект|обязательн[а-яё]* требован/iu,
};
export function categories(text:string){return Object.entries(patterns).filter(([,rx])=>rx.test(text)).map(([k])=>k);}
const labels:Record<string,string>={rates:'Финансы',inflation:'Цены',metals:'Металлы',fuel:'Энергоресурсы',trade:'Внешняя торговля',labor:'Команда',demand:'Спрос',logistics:'Логистика',tech:'Технологии',construction:'Строительство',regulation:'Регулирование'};
export function rankNews(news:News,company:Company,role:Role):RankedNews {
 const text=news.title+' '+news.body;const tags=categories(text);let score=0;
 const reasons:string[]=[];const fields:string[]=[];
 const add=(n:number,reason:string,field:string)=>{score+=n;reasons.push(reason);fields.push(field);};
 if(tags.includes('rates')&&company.products.includes('loan'))add(46,'Есть кредитные продукты; условия и тип ставки требуют уточнения.','products');
 if(tags.includes('rates')&&company.products.includes('deposit'))add(35,'В профиле отмечены депозиты: важен канал управления ликвидностью.','products');
 if(tags.includes('rates')&&role==='cfo')add(15,'Для финансового директора важны стоимость денег и размещение ликвидности.','role');
 const okved=parseInt(company.okved,10);const industry=company.industry.toLowerCase();
 if(tags.includes('construction')&&[41,42,43,68].includes(okved))add(48,'Строительство или недвижимость связаны с деятельностью компании.','okved');
 if(tags.includes('metals')&&(/металл|сталь|прокат|руд/.test(industry)||[24,25].includes(okved)))add(50,'Металлы связаны с основным видом деятельности компании.','okved');
 if(tags.includes('fuel')&&(/топлив|нефт|бензин|газ/.test(industry)||[19,49,50,51].includes(okved)))add(45,'Топливный рынок связан с деятельностью; фактические затраты неизвестны.','okved');
 if(tags.includes('trade')&&company.hasFts)add(38,'Есть данные ФТС; направление и объём торговли неизвестны.','hasFts');
 for(const country of company.countries)if(country.length>3&&text.toUpperCase().includes(country.slice(0,-1))){add(20,'Упомянута страна из данных ФТС: '+country+'.','countries');break;}
 if(tags.includes('logistics')&&[49,50,51,52].includes(okved))add(50,'Транспорт и логистика — основной вид деятельности.','okved');
 if(tags.includes('tech')&&([26,46,62,63].includes(okved)&&/компьют|программ|электрон|информац/.test(industry)))add(45,'Технологическое событие связано с деятельностью компании.','okved');
 if(tags.includes('demand')&&[10,11,41,45,46,47,55,56,68].includes(okved))add(35,'Динамика спроса может влиять на отрасль компании.','okved');
 if(tags.includes('labor')&&company.employees)add(25,'Есть данные о численности: стоит оценить кадровый канал влияния.','employees');
 if(tags.includes('inflation'))add(18,'Изменение цен — потенциальный фактор издержек; структура затрат не задана.','macro');
 if(tags.includes('regulation'))add(role==='cfo'?40:28,'Изменения регулирования требуют проверки применимости к компании.','role');
 const groupText=company.group.industries.join(' ').toLowerCase();
 if(company.group.size>1&&((tags.includes('metals')&&/металл|сталь|прокат/.test(groupText)&&!/металл|сталь|прокат/.test(industry))||(tags.includes('construction')&&/строитель|недвижим/.test(groupText)&&![41,42,43,68].includes(okved))||(tags.includes('logistics')&&/перевоз|транспорт|логист/.test(groupText)&&![49,50,51,52].includes(okved))))add(role==='ceo'?30:23,'Связанный вид деятельности есть в группе; фактический канал влияния требует проверки.','group');
 if(role==='ceo'&&company.group.size>1&&tags.some(t=>['demand','trade','construction','metals','fuel'].includes(t)))add(12,'Важен также контекст группы из '+company.group.size+' компаний.','group');
 if(!tags.length){score=0;reasons.length=0;fields.length=0;}
 if(score&&news.source.startsWith('Банк России'))score+=5;
 const age=news.publishedAt?(Date.now()-Date.parse(news.publishedAt))/86400000:0;
 if(age>120&&news.origin!=='user')score=0;
 else if(age>30){score=Math.max(0,score-10);reasons.push('Материал опубликован более месяца назад: актуальность условий нужно проверить.');}
 let kind:RankedNews['kind']='watch';
 if(company.products.includes('loan')&&tags.includes('rates')){
  if(/повыс[а-яё]* ключев|ключев[а-яё]* став[а-яё]* повыш/iu.test(news.title))kind='risk';
  if(/сниз[а-яё]* ключев|снижен[а-яё]* ключев/iu.test(news.title))kind='opportunity';
 }
 return {...news,score:Math.min(98,score),reasons:reasons.slice(0,3),matchedFields:[...new Set(fields)],category:labels[tags[0]]??'Обзор',kind};
}
export function rankFeed(items:News[],company:Company,role:Role){
 const titles=new Set<string>();return items.filter(n=>{const key=n.title.toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');if(titles.has(key))return false;titles.add(key);return true;})
 .map(n=>rankNews(n,company,role)).filter(n=>n.score>=18)
 .sort((a,b)=>b.score-a.score||(b.publishedAt??'').localeCompare(a.publishedAt??''));
}
export function scenarioImpact(debt:number,delta:number){
 if(!Number.isFinite(debt)||!Number.isFinite(delta)||debt<0||debt>1e14||Math.abs(delta)>30)throw new Error('Проверьте параметры сценария.');
 return {annual:debt*delta/100,monthly:debt*delta/1200};
}
