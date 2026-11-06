export const DATA_VERSION='2026-11-05.4';
export const ENGINE_VERSION='2026-11-06.12';
export const YEARS=Array.from({length:36},(_,i)=>1992+i);
export const CODES=['99212','99213','99214','99215','99202','99203','99204','99205'];
export const DEFAULT_MIX={'99212':6,'99213':36,'99214':44,'99215':9,'99202':1,'99203':1,'99204':2,'99205':1};
// The 2027 track questions, stored as answered (defaults are the lowest-paying choices):
// program: 2027 participation. 'aco' = MSSP ACO (any track, incl. PC Flex) or LEAD, which can bill B2 (CY2027 final rule);
//   'apm' = another Advanced APM (e.g. KCC, EOM), which bills B1; 'none' = no APM, B1.
// track: the 2027 MSSP/LEAD track (only with program 'aco'). It does not change 2027 prices.
// qp: QP in the 2025 performance year, which sets the 2027 conversion factor (QP status runs two years ahead).
export const PROGRAMS=['none','aco','apm'],TRACKS=['basic-ad','basic-e','enhanced','lead'];
// APCM (Advanced Primary Care Management): patients billed per month for each level, from January 1, 2025.
// Prices come from data.apcm (exported read-only from the project DuckDB): RVU × that year's conversion factor for the track.
export const APCM_CODES=['G0556','G0557','G0558'],APCM_START=2025,APCM_DATA_VERSION='2026-11-06.1';
export const defaultState=()=>({program:'none',track:null,qp:false,visits:20,days:22,mix:{...DEFAULT_MIX},complexity:25,apcm:{G0556:0,G0557:0,G0558:0}});
export function apcmFee(data,code,year,cf){if(year<APCM_START)return 0;const r=data.apcm?.rvus.find(r=>r.year===year&&r.code===code);if(!r)throw Error(`Missing APCM pricing: ${code} ${year}`);return cents(r.nf_total_rvu*cf);}
// The state for one of the four price combinations, keeping everything else.
export const comboState=(s,qp,b2)=>({...s,program:b2?'aco':qp?'apm':'none',track:b2?(s.program==='aco'?s.track:'basic-ad'):null,qp});
export const trackFor=s=>s.qp?'qp':'nonqp';
export const modifierFor=s=>s.program==='aco'?'B2':'B1';
// CY2027 PFS final rule: B1 = 16% and B2 = 32% of the total RVUs of the base E/M service on the claim.
export const MODIFIER_UPLIFT={B1:.16,B2:.32};
// Medicare FFS sequestration (Budget Control Act): 2% off Medicare's payment, taken after coinsurance and deductible, so the
// patient's 20% share is not reduced. Day-weighted annual rate: began April 1, 2013; suspended May 1, 2020 – March 31, 2022;
// 1% April 1 – June 30, 2022; 2% from July 1, 2022 (scheduled through FY2032). Sources: CRS R45106; MAC notices.
export const MEDICARE_SHARE=.8;
export const SEQUESTRATION=Object.fromEntries(Array.from({length:36},(_,i)=>1992+i).map(y=>[y,y<2013?0:y===2013?.02*275/365:y<2020?.02:y===2020?.02*121/366:y===2021?0:y===2022?(.01*91+.02*184)/365:.02]));
// Share of the allowed amount the practice keeps after sequestration.
export const sequestrationFactor=year=>1-MEDICARE_SHARE*SEQUESTRATION[year];
const finite=Number.isFinite,cents=n=>Math.round((n+Number.EPSILON)*100)/100;
export function validate(s){
 const e=[];if(!PROGRAMS.includes(s.program)||typeof s.qp!=='boolean'||(s.program==='aco'?!TRACKS.includes(s.track):s.track!==null)||(s.program==='none'&&s.qp))e.push('Answer the 2027 track questions.');
 if(!finite(s.visits)||s.visits<0||s.visits>1000)e.push('Visits per day must be between 0 and 1,000.');
 if(!Number.isInteger(s.days)||s.days<1||s.days>31)e.push('Working days must be a whole number from 1 to 31.');
 if(!finite(s.complexity)||s.complexity<0||s.complexity>100)e.push('Complexity billing must be between 0% and 100%.');
 if(!s.apcm||Object.keys(s.apcm).length!==APCM_CODES.length||APCM_CODES.some(c=>!finite(s.apcm[c])||s.apcm[c]<0||s.apcm[c]>10000))e.push('APCM patients must be between 0 and 10,000 for each level.');
 let sum=0;for(const c of CODES){if(!finite(s.mix?.[c])||s.mix[c]<0||s.mix[c]>100)e.push('Each visit share must be between 0% and 100%.');else sum+=s.mix[c];}
 if(Math.abs(sum-100)>.005)e.push(`Visit mix totals ${sum.toFixed(2)}%. Adjust shares or balance to 100%.`);
 return [...new Set(e)];
}
// Scale every share in proportion so the mix totals exactly 100, in whole percentages. Each share is floored,
// then the leftover points go to the shares with the largest remainders (ties: the larger share, then code order).
export function balanceMix(mix){const vals=Object.fromEntries(CODES.map(c=>[c,Math.max(0,Number(mix[c])||0)])),total=Object.values(vals).reduce((a,b)=>a+b,0);if(!total)return {...DEFAULT_MIX};const exact=Object.fromEntries(CODES.map(c=>[c,vals[c]/total*100])),m=Object.fromEntries(CODES.map(c=>[c,Math.floor(exact[c]+1e-9)]));let left=100-Object.values(m).reduce((a,b)=>a+b,0);for(const c of [...CODES].sort((a,b)=>(exact[b]-m[b])-(exact[a]-m[a])||exact[b]-exact[a]||CODES.indexOf(a)-CODES.indexOf(b))){if(left<=0)break;m[c]++;left--;}return m;}
export function conversionSeries(data,track){return YEARS.map(year=>{const r=data.annual.find(r=>r.year===year&&r.track===track);if(!r)throw Error(`Missing CF coverage: ${year}`);const indices=Object.fromEntries(['MEI','CPI'].map(s=>[s,data.indices.find(i=>i.year===year&&i.series===s)]));if(Object.values(indices).some(i=>!i||!finite(i.factor)||i.factor<=0))throw Error(`Missing deflator: ${year}`);return {year,nominal:r.cf,MEI:r.cf/indices.MEI.factor,CPI:r.cf/indices.CPI.factor,indices};});}
// Day-weighted annual amount from effective-period intervals, rounding each claim line to cents first.
const weighted=(intervals,line)=>intervals.reduce((a,r)=>a+line(r)*r.interval_days,0)/intervals[0].year_days;
const intervalsFor=(data,year,track,code)=>data.intervals.filter(r=>r.year===year&&r.track===track&&r.code===code);
// 2027 complexity modifier dollars for one code: whole-fee uplift, line-rounded as in the source database.
export function modifierIncrement(data,track,code,modifier){const iv=intervalsFor(data,2027,track,code);if(!iv.length)throw Error(`Missing 2027 pricing: ${code}`);const m=MODIFIER_UPLIFT[modifier];return weighted(iv,r=>cents(r.pricing_rvu*r.cf*(1+m))-cents(r.pricing_rvu*r.cf));}
export function calculate(data,s){
 const errors=validate(s);if(errors.length)return {valid:false,errors};
 try{
 const track=trackFor(s),modifier=modifierFor(s),cfs=conversionSeries(data,track),uptake=s.complexity/100;
 const years=YEARS.map(year=>{const rates=data.annual.filter(r=>r.year===year&&r.track===track);if(rates.length!==8||rates.some(r=>r.covered_days!==r.year_days)||CODES.some(c=>!rates.find(r=>r.code===c)))throw Error(`Incomplete price coverage: ${year}`);
 const rows=CODES.map(code=>{const rate=rates.find(r=>r.code===code);const increment=year===2027?modifierIncrement(data,track,code,modifier):rate.complexity_increment;const dailyVolume=s.visits*s.mix[code]/100;return {...rate,increment,dailyVolume,visitShare:s.mix[code],uptake,dailyBase:dailyVolume*rate.base_fee,dailyComplexity:dailyVolume*uptake*increment};});
 const c=cfs.find(r=>r.year===year),indices=c.indices,seq=sequestrationFactor(year);
 const grossBaseDaily=rows.reduce((a,r)=>a+r.dailyBase,0),grossComplexityDaily=rows.reduce((a,r)=>a+r.dailyComplexity,0),grossApcmMonthly=APCM_CODES.reduce((a,code)=>a+(s.apcm[code]?s.apcm[code]*apcmFee(data,code,year,c.nominal):0),0);
 const grossMonthly=(grossBaseDaily+grossComplexityDaily)*s.days+grossApcmMonthly,grossDaily=grossMonthly/s.days,nominalMonthly=grossMonthly*seq,nominalDaily=nominalMonthly/s.days,baseDaily=grossBaseDaily*seq,complexityDaily=grossComplexityDaily*seq;
 return {year,rows,indices,cf:c.nominal,sequestration:SEQUESTRATION[year],grossDaily,grossMonthly,grossBaseMonthly:grossBaseDaily*s.days,grossComplexityMonthly:grossComplexityDaily*s.days,grossApcmMonthly,apcmMonthly:grossApcmMonthly*seq,nominalDaily,nominalMonthly,baseMonthly:baseDaily*s.days,complexityMonthly:complexityDaily*s.days,MEIMonthly:nominalMonthly/indices.MEI.factor,CPIMonthly:nominalMonthly/indices.CPI.factor,MEIDaily:nominalDaily/indices.MEI.factor,CPIDaily:nominalDaily/indices.CPI.factor,modifier:year===2027?modifier:year>=2024?'G2211':'None'};});
 return {valid:true,track,modifier,years,cfs,latest:years.at(-1),base:years[0]};
 }catch(e){return {valid:false,errors:[e.message]};}
}
// CY2027 PFS final rule, Tables D-B1/D-B2: the 2026 CFs without the one-year 2.5% statutory increase that
// applied only to 2026. The 2027 CF = this × the 2027 update (QP +0.75%, non-QP +0.25%) × 0.9988 budget neutrality.
export const CF_2026_WITHOUT_ONE_YEAR_INCREASE={nonqp:32.5863,qp:32.7488};
// 2026 → 2027 monthly change, split into four parts that add up exactly to the total:
// the expiring 2026 one-year increase (2026 RVUs, incl. G2211, at the CF without it), the 2027 CF update and
// budget neutrality (same RVUs at the 2027 CF), RVU revaluation (2027 vs 2026 RVUs at the 2027 CF),
// and complexity coding (2027 B1/B2 vs G2211 at the 2027 CF).
export function changeBreakdown(data,s){
 const r=calculate(data,s);if(!r.valid)return null;
 const track=r.track,y26=r.years.find(y=>y.year===2026),y27=r.latest,cf27=y27.cf,cfMid=CF_2026_WITHOUT_ONE_YEAR_INCREASE[track],uptake=s.complexity/100;
 const at=cf=>CODES.reduce((a,code)=>{const monthly=s.visits*s.days*s.mix[code]/100,iv=intervalsFor(data,2026,track,code);return {base:a.base+monthly*weighted(iv,x=>cents(x.pricing_rvu*cf)),complexity:a.complexity+monthly*uptake*weighted(iv,x=>cents(x.g2211_rvu*cf))};},{base:0,complexity:0});
 const mid=at(cfMid),end=at(cf27),sum=p=>p.base+p.complexity;
 // Parts are priced before sequestration, then scaled by 2027's sequestration factor; any change in the sequestration
 // rate itself is its own part, so the parts still add up exactly to the after-sequestration change.
 const f26=sequestrationFactor(2026),f27=sequestrationFactor(2027);
 const em26=y26.grossBaseMonthly+y26.grossComplexityMonthly,apcm=(y27.grossApcmMonthly-y26.grossApcmMonthly)*f27;
 const oneYearIncreaseExpires=(sum(mid)-em26)*f27,cfUpdate=(sum(end)-sum(mid))*f27,revaluation=(y27.grossBaseMonthly-end.base)*f27,coding=(y27.grossComplexityMonthly-end.complexity)*f27,sequestration=(f27-f26)*y26.grossMonthly,total=y27.nominalMonthly-y26.nominalMonthly;
 const pct=(a,b)=>b?a/b-1:null,adjusted=k=>y26.nominalMonthly*y27.indices[k].factor/y26.indices[k].factor;
 return {from:y26,to:y27,modifier:r.modifier,cf:{from:y26.cf,withoutIncrease:cfMid,to:cf27,change:pct(cf27,y26.cf),expiry:pct(cfMid,y26.cf),update:pct(cf27,cfMid)},total,totalPct:pct(y27.nominalMonthly,y26.nominalMonthly),parts:{oneYearIncreaseExpires,cfUpdate,revaluation,coding,apcm,sequestration},
  inflation:Object.fromEntries(['CPI','MEI'].map(k=>[k,{from:adjusted(k),change:y27.nominalMonthly-adjusted(k),pct:pct(y27.nominalMonthly,adjusted(k)),rate:y27.indices[k].factor/y26.indices[k].factor-1}]))};
}
// Any year's change from the year before, split the same way (before 2027's finer conversion-factor split):
// conversion factor (last year's RVUs and G2211 repriced at this year's CF), RVU revaluation (this year's RVUs,
// including work adjustments, at this year's CF), complexity coding, APCM and sequestration. Parts add up exactly.
export function yearBreakdown(data,s,year,r=calculate(data,s)){
 if(!r.valid||!YEARS.includes(year)||year===YEARS[0])return null;
 const track=r.track,a=r.years.find(y=>y.year===year-1),b=r.years.find(y=>y.year===year),cf=b.cf,uptake=s.complexity/100;
 const re=CODES.reduce((acc,code)=>{const monthly=s.visits*s.days*s.mix[code]/100,iv=intervalsFor(data,year-1,track,code);return {base:acc.base+monthly*weighted(iv,x=>cents(x.pricing_rvu*cf)),complexity:acc.complexity+(year-1>=2024?monthly*uptake*weighted(iv,x=>cents((x.g2211_rvu||0)*cf)):0)};},{base:0,complexity:0});
 const fA=sequestrationFactor(year-1),fB=sequestrationFactor(year);
 const parts={conversionFactor:(re.base+re.complexity-a.grossBaseMonthly-a.grossComplexityMonthly)*fB,revaluation:(b.grossBaseMonthly-re.base)*fB,coding:(b.grossComplexityMonthly-re.complexity)*fB,apcm:(b.grossApcmMonthly-a.grossApcmMonthly)*fB,sequestration:(fB-fA)*a.grossMonthly};
 return {year,from:a,to:b,cf:{from:a.cf,to:cf},total:b.nominalMonthly-a.nominalMonthly,totalPct:a.nominalMonthly?b.nominalMonthly/a.nominalMonthly-1:null,parts};
}
export function eventsFor(data,s){
 const events=[];
 for(const year of YEARS.slice(1)){
 const changes=CODES.filter(c=>s.mix[c]>0).flatMap(code=>{const a=data.rvus.find(r=>r.year===year-1&&r.code===code),b=data.rvus.find(r=>r.year===year&&r.code===code);return a&&b&&['work','pe','mp'].some(k=>a[k]!==b[k])?[{code,old:a,current:b}]:[];});
 if(changes.length)events.push({year,type:'valuation',title:'Office RVU changes',changes});
 }
 const methods={1992:'RBRVS national reference begins',1996:'Charge transition ends',1997:'Work adjustment ×0.917',1998:'One unified CF',1999:'Resource-based PE transition; work adjustment ends',2000:'Resource-based malpractice RVUs',2002:'PE transition completed',2007:'Five-year review; work ×0.8994; new PE transition',2008:'Work adjustment ×0.8806',2009:'Work adjustment moves into CF',2010:'Revised PE methodology transition',2013:'Revised PE transition completed',2021:'Office E/M revaluation and documentation changes',2026:'QP and non-QP CFs diverge'};
 for(const [y,title] of Object.entries(methods))events.push({year:Number(y),type:'methodology',title,changes:[]});
 events.push({year:2024,type:'coding',title:'G2211 becomes separately payable',changes:[]},{year:2027,type:'coding',title:`G2211 replaced by ${modifierFor(s)}`,changes:[]});
 return events.sort((a,b)=>a.year-b.year);
}
