export type Role = 'cfo' | 'ceo';
export type Company = {
 id:string; industry:string; okved:string; city:string; region:string;
 revenue:number|null; revenueYear:number; groupId:string|null; clientType:string;
 employees:string|null; stage:string; age:string; products:string[]; countries:string[];
 hasFts:boolean; hasVerifiedOwner:boolean; warnings:string[]; linkedPeopleCount:number;
 group:{id:string|null;size:number;industries:string[];memberIds:string[];reportedRevenueSum:number;revenueKnown:number;revenueSumIsConsolidated:false};
 payments:{incoming:number;outgoing:number;incomingCount:number;outgoingCount:number;self:number;selfCount:number;
 knownIncoming:number;knownOutgoing:number;coverageNote:string;edges:{id:string;amount:number;count:number;direction:string;known:boolean;industry?:string;sameGroup:boolean}[]};
};
export type News = {id:string;title:string;body:string;url:string;source:string;publishedAt:string|null;feedUrl?:string;origin:'rss'|'user';contentScope:string};
export type RankedNews = News & {score:number;reasons:string[];category:string;kind:'risk'|'opportunity'|'watch';matchedFields:string[]};
export type BankChunk = {id:string;documentId:string;title:string;date:string;url:string;page:number;text:string;historical:boolean;ocr:boolean};
export type BankDocument = {id:string;title:string;date:string;url:string;filename:string;historical:boolean};
export type BankCorpus = {documents:BankDocument[];chunks:BankChunk[];pages:{documentId:string;page:number;text:string}[]};
export type Trace = {tool:string;label:string;detail:string;status:'done'|'working'|'warning';at:string};
export type Insight = {
 headline:string;summary:string;
 whyForYou:{text:string;companyFields:string[]}[];
 impacts:{kind:'risk'|'opportunity'|'watch';text:string;sourceIds:string[]}[];
 bankView:{text:string;sourceIds:string[];asOf:string|null};
 actions:string[];missingData:string[];confidence:'low'|'medium'|'high';
 evidenceQuery?:string;
};
export type Analysis = {insight:Insight;trace:Trace[];sources:BankChunk[];news:News;generatedAt:string;cached:boolean;model:string;reviewed:boolean};
export type Assumptions = {floatingDebt?:number;rateChange?:number;tradeDirection?:'import'|'export'|'unknown'};
