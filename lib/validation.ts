import {z} from 'zod';
import type {Assumptions,BankChunk,Company,Insight,News} from './types';
export const insightSchema=z.object({
 headline:z.string().min(3).max(240),summary:z.string().min(10).max(1800),
 whyForYou:z.array(z.object({text:z.string().max(1000),companyFields:z.array(z.string()).max(8)})).min(1).max(5),
 impacts:z.array(z.object({kind:z.enum(['risk','opportunity','watch']),text:z.string().max(1000),sourceIds:z.array(z.string()).min(1).max(6)})).min(1).max(5),
 bankView:z.object({text:z.string().max(1800),sourceIds:z.array(z.string()).max(6),asOf:z.string().nullable()}),
 actions:z.array(z.string().max(500)).min(1).max(5),missingData:z.array(z.string().max(500)).max(8),
 confidence:z.enum(['low','medium','high']),evidenceQuery:z.preprocess(v=>v===null?undefined:v,z.string().max(200).optional()),
});
export function parseJSON(text:string){
 const clean=text.replace(/<think>[\s\S]*?<\/think>/g,'').replace(/^```(?:json)?\s*|\s*```$/g,'').trim();
 const a=clean.indexOf('{'),b=clean.lastIndexOf('}');if(a<0||b<a)throw Error('Модель не вернула структурированный ответ.');
 try{return JSON.parse(clean.slice(a,b+1));}catch{throw Error('Модель вернула некорректный формат ответа. Попробуйте сузить вопрос.');}
}
export function validateEvidence(insight:Insight,sources:BankChunk[],news:News){
 const valid=new Set([news.id,...sources.map(s=>s.id)]);
 for(const impact of insight.impacts)for(const id of impact.sourceIds)if(!valid.has(id))throw Error('Проверка остановила вывод с неизвестным источником.');
 for(const id of insight.bankView.sourceIds)if(!sources.some(s=>s.id===id))throw Error('Позиция банка не подтверждена выбранными материалами.');
 if(insight.bankView.sourceIds.length&&!insight.bankView.asOf)throw Error('У позиции банка должна быть указана дата.');
 if(insight.bankView.sourceIds.length&&!sources.some(s=>insight.bankView.sourceIds.includes(s.id)&&s.date===insight.bankView.asOf))throw Error('Дата позиции банка не совпадает с датой процитированного материала.');
 const fields=new Set(['products','countries','group','revenue','okved','role','employees','assumptions','hasFts','city','region','payments','warnings']);
 for(const why of insight.whyForYou)for(const field of why.companyFields)if(!fields.has(field))throw Error('Вывод ссылается на отсутствующий признак компании.');
}
export function personalizationIssues(insight:Insight,assumptions:Assumptions={}){
 const issues=new Set<string>();
 const texts=[insight.summary,...insight.whyForYou.map(w=>w.text),...insight.impacts.map(i=>i.text)];
 for(const text of texts)for(const sentence of text.split(/(?<=[.!?])\s+/u)){
  const conditional=/если|в случае|при наличии|при условии|условн|неизвест|не установлен|нужно уточнить|требует уточнения/iu.test(sentence);
  if(!conditional&&/(?:высок[а-яё]*|значительн[а-яё]*|существенн[а-яё]*) дол[а-яё]* (?:импорт|экспорт)|дол[а-яё]* (?:импорт|экспорт)[а-яё]* (?:составляет|превышает|достигает)/iu.test(sentence))issues.add('Доля импорта/экспорта неизвестна. Удали утверждение о высокой доле и не заменяй его новым предположением.');
  if(!conditional&&(!assumptions.tradeDirection||assumptions.tradeDirection==='unknown')&&/компани[а-яё]* (?:импортирует|экспортирует)|ваш[а-яё]* (?:импорт|экспорт)|зависим[а-яё]* от импорт/iu.test(sentence))issues.add('Направление торговли неизвестно. ФТС подтверждает связь со странами, а не импорт или экспорт. Допускается только явно условный сценарий.');
  if(!conditional&&assumptions.floatingDebt===undefined&&/плавающ|(?:привязан|привязк)[а-яё]*.{0,45}ключев|текущ[а-яё]*.{0,120}привязк/iu.test(sentence))issues.add('Тип ставки по долгам компании неизвестен. Последствия изменения ставки формулируй с явным условием «Если в договорах есть плавающая ставка…».');
 }
 return [...issues];
}
export function limitToGroundedStatements(insight:Insight,assumptions:Assumptions,company:Company,news:News):Insight{
 const unsafe=(text:string)=>personalizationIssues({...insight,summary:text,whyForYou:[],impacts:[]},assumptions).length>0;
 const clean=(text:string)=>text.split(/(?<=[.!?])\s+/u).filter(s=>!unsafe(s)).join(' ').trim();
 const whyForYou=insight.whyForYou.map(w=>({...w,text:clean(w.text)})).filter(w=>w.text.length>15);
 const impacts=insight.impacts.map(i=>({...i,text:clean(i.text)})).filter(i=>i.text.length>15);
 const actions=insight.actions.filter(a=>!unsafe(a));
 return {...insight,
  headline:unsafe(insight.headline)?news.title.slice(0,200):insight.headline,
  summary:clean(insight.summary)||'Применимость события к компании требует уточнения. Доступных параметров недостаточно для надёжной оценки последствий.',
  whyForYou:whyForYou.length?whyForYou:[{text:'Основной вид деятельности компании: '+company.industry+'. Прямой канал влияния события нужно подтвердить.',companyFields:['okved']}],
  impacts:impacts.length?impacts:[{kind:'watch',text:'Персональные последствия пока не установлены: необходимо уточнить параметры компании, связанные с событием.',sourceIds:[news.id]}],
  actions:actions.length?actions:['Уточнить недостающие параметры перед принятием решения.'],
  missingData:[...new Set(['Часть выводов удалена проверкой: торговые доли и тип ставки по долгам не установлены.',...insight.missingData])].slice(0,8),confidence:'low',
 };
}
