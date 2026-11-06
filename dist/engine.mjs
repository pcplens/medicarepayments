import {DATA_SHA256} from './data/provenance.mjs';
export const DATA_VERSION='2026-11-05.4';
export const ENGINE_VERSION='2026-11-05.10';
export const YEARS=Array.from({length:36},(_,i)=>1992+i),CHECKPOINTS=[1992,2001,2026,2027];
export const CODES=['99212','99213','99214','99215','99202','99203','99204','99205'];
export const DEFAULT_MIX={'99212':5.56,'99213':36.11,'99214':44.44,'99215':8.89,'99202':.83,'99203':1.39,'99204':2.22,'99205':.56};
export const defaultState=()=>({profile:'nonqp',visits:18,days:20,mix:{...DEFAULT_MIX},complexity:25,inflation:'MEI'});
export const modifierFor=s=>s.profile==='qp'?'B2':'B1';
const finite=Number.isFinite;
export function validate(s){
 const e=[];if(!['nonqp','qp'].includes(s.profile))e.push('Choose a practice preset.');
 if(!['MEI','CPI'].includes(s.inflation))e.push('Choose MEI or CPI.');
 if(!finite(s.visits)||s.visits<0||s.visits>1000)e.push('Visits per day must be between 0 and 1,000.');
 if(!Number.isInteger(s.days)||s.days<1||s.days>31)e.push('Working days must be a whole number from 1 to 31.');
 if(!finite(s.complexity)||s.complexity<0||s.complexity>100)e.push('Complexity billing must be between 0% and 100%.');
 let sum=0;for(const c of CODES){if(!finite(s.mix?.[c])||s.mix[c]<0||s.mix[c]>100)e.push('Each visit share must be between 0% and 100%.');else sum+=s.mix[c];}
 if(Math.abs(sum-100)>.005)e.push(`Visit mix totals ${sum.toFixed(2)}%. Adjust shares or balance to 100%.`);
 return [...new Set(e)];
}
export function balanceMix(mix){const total=CODES.reduce((a,c)=>a+Math.max(0,Number(mix[c])||0),0);if(!total)return {...DEFAULT_MIX};const m=Object.fromEntries(CODES.map(c=>[c,Math.round(Math.max(0,Number(mix[c])||0)/total*10000)/100]));const largest=CODES.reduce((a,c)=>m[c]>m[a]?c:a,CODES[0]);m[largest]=Math.round((m[largest]+100-Object.values(m).reduce((a,b)=>a+b,0))*100)/100;return m;}
export function conversionSeries(data,profile){return YEARS.map(year=>{const r=data.annual.find(r=>r.year===year&&r.track===profile);if(!r)throw Error(`Missing CF coverage: ${year}`);const indices=Object.fromEntries(['MEI','CPI'].map(s=>[s,data.indices.find(i=>i.year===year&&i.series===s)]));if(Object.values(indices).some(i=>!i||!finite(i.factor)||i.factor<=0))throw Error(`Missing deflator: ${year}`);return {year,nominal:r.cf,MEI:r.cf/indices.MEI.factor,CPI:r.cf/indices.CPI.factor,indices};});}
export function calculate(data,s){
 const errors=validate(s);if(errors.length)return {valid:false,errors};
 try{
 const cfs=conversionSeries(data,s.profile);
 const years=YEARS.map(year=>{const rates=data.annual.filter(r=>r.year===year&&r.track===s.profile);if(rates.length!==8||rates.some(r=>r.covered_days!==r.year_days)||CODES.some(c=>!rates.find(r=>r.code===c)))throw Error(`Incomplete price coverage: ${year}`);
 const index=data.indices.find(i=>i.year===year&&i.series===s.inflation);const rows=CODES.map(code=>{const rate=rates.find(r=>r.code===code);const dailyVolume=s.visits*s.mix[code]/100;const uptake=code.startsWith('9921')?s.complexity/100:0;return {...rate,dailyVolume,visitShare:s.mix[code],uptake,dailyBase:dailyVolume*rate.base_fee,dailyComplexity:dailyVolume*uptake*rate.complexity_increment,dailyAlternate:dailyVolume*(rate.base_fee+uptake*(year===2027?rate.crosswalk_increment:rate.complexity_increment))};});
 const nominalDaily=rows.reduce((a,r)=>a+r.dailyBase+r.dailyComplexity,0),nominalMonthly=nominalDaily*s.days,realMonthly=nominalMonthly/index.factor;
 const priceIndices=cfs.find(r=>r.year===year).indices;
 return {year,rows,MEIMonthly:nominalMonthly/priceIndices.MEI.factor,CPIMonthly:nominalMonthly/priceIndices.CPI.factor,MEIDaily:nominalDaily/priceIndices.MEI.factor,CPIDaily:nominalDaily/priceIndices.CPI.factor,indices:priceIndices,cf:cfs.find(r=>r.year===year).nominal,nominalDaily,nominalMonthly,realDaily:nominalDaily/index.factor,realMonthly,index,alternateMonthly:rows.reduce((a,r)=>a+r.dailyAlternate,0)*s.days,complexityMonthly:rows.reduce((a,r)=>a+r.dailyComplexity,0)*s.days,modifier:year===2027?modifierFor(s):year>=2024?'G2211':'None'};});
 return {valid:true,years,cfs,latest:years.at(-1),base:years[0]};
 }catch(e){return {valid:false,errors:[e.message]};}
}
export function eventsFor(data,s){
 const events=[];
 for(const year of YEARS.slice(1)){
 const changes=CODES.filter(c=>s.mix[c]>0).flatMap(code=>{const a=data.rvus.find(r=>r.year===year-1&&r.code===code),b=data.rvus.find(r=>r.year===year&&r.code===code);return a&&b&&['work','pe','mp'].some(k=>a[k]!==b[k])?[{code,old:a,current:b}]:[];});
 if(changes.length)events.push({year,type:'valuation',title:'Office RVU changes',changes});
 }
 const methods={1992:'RBRVS national reference begins',1996:'Charge transition ends',1997:'Work adjustment ×0.917',1998:'One unified CF',1999:'Resource-based PE transition; work adjustment ends',2000:'Resource-based malpractice RVUs',2002:'PE transition completed',2007:'Five-year review; work ×0.8994; new PE transition',2008:'Work adjustment ×0.8806',2009:'Work adjustment moves into CF',2010:'Revised PE methodology transition',2013:'Revised PE transition completed',2021:'Office E/M revaluation and documentation changes',2026:'QP and non-QP CFs diverge'};
 for(const [y,title] of Object.entries(methods))events.push({year:Number(y),type:'methodology',title,changes:[]});
 events.push({year:2024,type:'coding',title:'G2211 becomes separately payable',changes:[]},{year:2027,type:'coding',title:`G2211 replaced by ${modifierFor(s)} in selected preset`,changes:[]});
 return events.sort((a,b)=>a.year-b.year);
}
export const serialize=(s,version=DATA_VERSION,view={year:2027})=>encodeURIComponent(JSON.stringify({version,state:s,view}));
export function restore(value){try{const r=JSON.parse(decodeURIComponent(value));if(r.version!==DATA_VERSION)return {error:'This scenario uses an unsupported data version or older modifier controls. Review the current defaults before continuing.'};const keys=Object.keys(defaultState());if(!r.state||Object.keys(r.state).some(k=>!keys.includes(k)))return {error:'Unsupported scenario settings. Review the current defaults before continuing.'};const s=r.state;if(!s.mix||Object.keys(s.mix).length!==CODES.length||Object.keys(s.mix).some(c=>!CODES.includes(c)))return {error:'Unsupported visit-mix codes in the shared scenario.'};const view=r.view??{year:2027};if(!Number.isInteger(view.year)||!YEARS.includes(view.year)||Object.keys(view).some(k=>k!=='year'))return {error:'Unsupported inspected year in the shared view.'};return validate(s).length?{error:'The shared scenario has invalid settings.'}:{state:s,view};}catch{return {error:'The shared scenario could not be read.'};}}
export function csv(data,s,result,view={year:2027}){
 if(!result.valid)throw Error('Invalid scenario');
 const lines=[['Medicare Payment Explorer','Historical national office reference'],['Data version',data.version],['Engine version',ENGINE_VERSION],['Data SHA256',DATA_SHA256],['Source payload SHA256',data.sourcePayloadSha256],['As of',data.asOf],['Base year',1992],['Adjusted measures','CPI and CMS MEI published update chain; constant 1992 dollars'],['Inspected year',view.year],['MEI definition','CMS published MEI update chain including productivity; not realized practice-cost inflation'],['CPI forecast vintage','CBO February 2026 annual-average growth extension anchored to BLS 2025'],['Scenario JSON',JSON.stringify(s)],['Preset',s.profile],['2027 modifier',modifierFor(s)],['FFS visits per day',s.visits],['Working days per month',s.days],['Complexity share of established visits (%)',s.complexity],['Scope','Gross national allowed amounts including patient share; before expenses, collections, MIPS, sequester; no AWV, TCM, procedures or separate APM incentives'],[],['Code','Visit share (%)'],...CODES.map(c=>[c,s.mix[c]]),[],['Year','Nominal CF','MEI CF (1992 dollars)','CPI CF (1992 dollars)','MEI factor (1992=1)','MEI status','CPI factor (1992=1)','CPI status','Nominal daily','MEI daily (1992 dollars)','CPI daily (1992 dollars)','Nominal monthly','MEI monthly (1992 dollars)','CPI monthly (1992 dollars)','Alternate 2027 compensation-crosswalk nominal monthly','Complexity code']];
 for(const y of result.years){const cf=result.cfs.find(r=>r.year===y.year);lines.push([y.year,y.cf,cf.MEI,cf.CPI,y.indices.MEI.factor,y.indices.MEI.status,y.indices.CPI.factor,y.indices.CPI.status,y.nominalDaily,y.MEIDaily,y.CPIDaily,y.nominalMonthly,y.MEIMonthly,y.CPIMonthly,y.year===2027?y.alternateMonthly:'',y.modifier]);}
 lines.push([],['Year','Track','Code','Effective start','Effective end','Calendar days','CF','Published work','Office PE','MP','Published total','Work factor','Work product rounding decimals','Pricing RVU','Base fee (rounded line)','Complexity increment (rounded lines)','Crosswalk increment','RVU source']);
 for(const r of data.intervals.filter(r=>r.track===s.profile))lines.push([r.year,r.track,r.code,r.effective_start,r.effective_end,r.interval_days,r.cf,r.work,r.pe,r.mp,r.total,r.work_factor,r.work_round??'retain precision',r.pricing_rvu,r.base_fee,r.complexity_increment,r.crosswalk_increment,r.source_id]);
 lines.push([],['Series','Year','Factor (1992=1)','Index level','Growth rate','Status','Source ID']);for(const i of data.indices)lines.push([i.series,i.year,i.factor,i.index_level,i.growth_rate,i.status,i.source_id]);
 lines.push([],['Source ID','Official URL','Retained source SHA256','Hash scope','Archive SHA256','Archive member','Locator','Vintage']);for(const r of data.sources)lines.push([r.id,r.url,r.sha256,r.hash_scope||'source bytes',r.archive_sha256||'',r.archive_member||'',r.locator||'',r.vintage||r.modified||r.publication_date||'']);
 return '\uFEFF'+lines.map(row=>row.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\r\n');
}
