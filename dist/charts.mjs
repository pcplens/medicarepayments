const NS='http://www.w3.org/2000/svg';const add=(p,t,a={},text)=>{const e=document.createElementNS(NS,t);for(const[k,v]of Object.entries(a))e.setAttribute(k,v);if(text!==undefined)e.textContent=text;p.append(e);return e;};
const axis=n=>n>=1e6?'$'+(n/1e6).toFixed(1)+'m':n>=1000?'$'+(Math.abs(n%1000)<1?Math.round(n/1000):(n/1000).toFixed(1))+'k':'$'+Math.round(n);
const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n);
function nice(span){const m=10**Math.floor(Math.log10(span));return [1,2,2.5,5,10].map(k=>k*m).find(s=>span/s<=5);}
const TAGS={1997:'RVU ↑',1999:'Expenses',2007:'RVU ↑',2021:'E/M RVU',2024:'G2211',2025:'CF ↓',2026:'CF, PE ↑'};
// from: first year shown. Full history uses a $0 baseline; the zoomed view uses a tighter, labeled range.
export function drawMonthly(svg,buttons,{points,events,onOpen,from=1992,tooltip}){
 const shown=points.filter(p=>p.year>=from),span=2027-from,full=from===1992;
 const w=Math.max(240,svg.parentElement.clientWidth),phone=w<600,left=phone?44:58,rightPad=phone?20:24;
 const X0=y=>left+(y-from)/span*(w-left-rightPad);
 const lanes=[],layout=events.filter(e=>e.year>=from).map(e=>{const bw=phone?76:Math.min(195,Math.max(140,(e.label.length+7)*5.8)),cx=Math.max(bw/2+2,Math.min(w-bw/2-2,X0(e.year)));let lane=lanes.findIndex(end=>cx-bw/2>=end+6);if(lane<0){lane=lanes.length;lanes.push(-Infinity);}lanes[lane]=cx+bw/2;return {e,bw,cx,lane};});
 const step=phone?50:42,top=Math.max(45,lanes.length*step+16),h=top+(phone?220:285)+36,bottom=h-36,right=w-rightPad;
 const values=shown.flatMap(p=>[p.nominal,p.CPI,p.MEI]);let lo,hi,tick;
 if(full){tick=nice(Math.max(...values)*1.08/4);lo=0;hi=Math.ceil(Math.max(...values)*1.08/tick)*tick;}
 else{const a=Math.min(...values),b=Math.max(...values);tick=nice((b-a)*1.3/4||1000);lo=Math.floor((a-(b-a)*.15)/tick)*tick;hi=Math.ceil((b+(b-a)*.15)/tick)*tick;if(lo<0)lo=0;}
 const X=X0,Y=v=>bottom-(bottom-top)*(v-lo)/(hi-lo);
 svg.parentElement.classList.toggle('compact-chart',phone);
 svg.replaceChildren();buttons.replaceChildren();svg.setAttribute('viewBox',`0 0 ${w} ${h}`);svg.dataset.range=`${from}-2027`;
 add(svg,'title',{id:'chart-title'},`Monthly Medicare payments, ${from} to 2027`);
 add(svg,'desc',{id:'chart-desc'},`Nominal payments in each year’s dollars, plus CPI-adjusted and MEI-adjusted payments in constant 2027 dollars. All three lines meet in 2027.${full?' 1992 to 1995 are shaded: national reference values without local charge-transition blending.':' The vertical axis does not start at zero.'} Labeled event buttons open details. Exact yearly values are in the comparison table and download.`);
 if(full){add(svg,'rect',{x:X(1992),y:top,width:X(1995.5)-X(1992),height:bottom-top,class:'caveat-band'});add(svg,'text',{x:X(1992)+4,y:top+14,class:'caveat-label'},phone?'Ref.':'Reference only');}
 for(let v=lo;v<=hi+1e-9;v+=tick){add(svg,'line',{x1:left,x2:right,y1:Y(v),y2:Y(v),class:'grid-line'});add(svg,'text',{x:left-8,y:Y(v)+4,'text-anchor':'end',class:'axis-text'},axis(v));}
 if(!full)add(svg,'text',{x:left,y:top-6,class:'axis-note'},'Axis does not start at $0');
 const years=full?(phone?[1992,2000,2010,2020,2027]:[1992,1995,2000,2005,2010,2015,2020,2027]):shown.map(p=>p.year);
 for(const year of years)add(svg,'text',{x:X(year),y:bottom+24,'text-anchor':year===from?'start':year===2027?'end':'middle',class:'axis-text'},year);
 for(const key of ['CPI','MEI','nominal'])add(svg,'path',{d:shown.map((p,i)=>(i?'L':'M')+X(p.year)+','+Y(p[key])).join(' '),class:'monthly-line '+key});
 if(!full)for(const p of shown)add(svg,'circle',{cx:X(p.year),cy:Y(p.nominal),r:3,class:'year-point'});
 for(const {e,bw,cx,lane} of layout){const b=document.createElement('button');b.type='button';b.className='event-button';b.dataset.year=e.year;b.setAttribute('aria-label',`${e.year}: ${e.label}. Open details`);b.setAttribute('aria-haspopup','dialog');const y=6+lane*step;b.style.cssText=`left:${cx-bw/2}px;top:${y}px;width:${bw}px`;const tag=e.year===2027?e.label.split(' ')[0]:TAGS[e.year]||e.label;b.innerHTML=`<b>${e.year}</b><span>${phone?tag:e.label}</span><i aria-hidden="true">›</i>`;b.onclick=()=>onOpen(e.year,b);buttons.append(b);const point=points.find(p=>p.year===e.year);add(svg,'path',{d:`M ${X(e.year)} ${top-3} L ${X(e.year)} ${Y(point.nominal)}`,class:'event-guide'});add(svg,'circle',{cx:X(e.year),cy:Y(point.nominal),r:3.7,class:'event-point'});}
 // Hover / tap readout. Values are also in the comparison table and CSV for keyboard and screen-reader users.
 if(tooltip){const cursor=add(svg,'line',{x1:0,x2:0,y1:top,y2:bottom,class:'hover-line',visibility:'hidden'});const hit=add(svg,'rect',{x:left,y:top,width:right-left,height:bottom-top,class:'hover-target'});
  const show=evt=>{const r=svg.getBoundingClientRect(),sx=(evt.clientX-r.left)*w/r.width,year=Math.max(from,Math.min(2027,Math.round(from+(sx-left)/(right-left)*span))),p=points.find(p=>p.year===year),prev=points.find(p=>p.year===year-1);cursor.setAttribute('x1',X(year));cursor.setAttribute('x2',X(year));cursor.setAttribute('visibility','visible');const change=prev&&prev.nominal?` <small>${p.nominal>=prev.nominal?'+':'−'}${Math.abs((p.nominal/prev.nominal-1)*100).toFixed(1)}% vs ${year-1}</small>`:'';tooltip.innerHTML=`<b>${year}</b><span class="nominal">Nominal ${money(p.nominal)}${change}</span><span class="CPI">CPI-adjusted ${money(p.CPI)}</span><span class="MEI">MEI-adjusted ${money(p.MEI)}</span>`;tooltip.hidden=false;const px=X(year)/w*r.width,tw=tooltip.offsetWidth;tooltip.style.left=Math.max(0,Math.min(r.width-tw,px-tw/2))+'px';tooltip.style.top=(Y(Math.max(p.nominal,p.CPI,p.MEI))/h*r.height-tooltip.offsetHeight-12)+'px';};
  const hide=()=>{tooltip.hidden=true;cursor.setAttribute('visibility','hidden');};
  hit.addEventListener('pointermove',show);hit.addEventListener('pointerdown',show);hit.addEventListener('pointerleave',hide);}
}
