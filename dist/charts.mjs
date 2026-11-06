const NS='http://www.w3.org/2000/svg';const add=(p,t,a={},text)=>{const e=document.createElementNS(NS,t);for(const[k,v]of Object.entries(a))e.setAttribute(k,v);if(text!==undefined)e.textContent=text;p.append(e);return e;};
const axis=n=>n>=1e6?'$'+(n/1e6).toFixed(1)+'m':n>=1000?'$'+(Math.abs(n%1000)<1?Math.round(n/1000):(n/1000).toFixed(1))+'k':'$'+Math.round(n);
const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n);
const pct=(a,b)=>b?`${a>=b?'+':'−'}${Math.abs((a/b-1)*100).toFixed(1)}%`:'—';
const signed=n=>(Math.round(n)>0?'+':Math.round(n)<0?'−':'')+money(Math.abs(n));
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function nice(span){const m=10**Math.floor(Math.log10(span));return [1,2,2.5,5,10].map(k=>k*m).find(s=>span/s<=5);}
// Year ticks: both endpoints, plus round years spaced so labels never crowd.
function yearTicks(from,to,max){const span=to-from,step=[1,2,5,10].find(s=>span/s<=max)??10,ticks=[from];for(let y=Math.ceil((from+1)/step)*step;y<to;y+=step)if(y-from>=step*.6&&to-y>=step*.6)ticks.push(y);ticks.push(to);return ticks;}
export const LANES=['rate','rvu','coding'],LANE_LABELS={rate:'Rate',rvu:'RVU',coding:'Coding'};
// points: series in the end year's dollars. events: {id,year,category,label,detail}. hidden: Set of filtered-out categories.
export function drawMonthly(svg,overlay,{points,events,onOpen,from=1992,to=2027,tooltip,hidden=new Set()}){
 const shown=points.filter(p=>p.year>=from&&p.year<=to),span=to-from,full=span>=10;
 const w=Math.max(240,svg.parentElement.clientWidth),phone=w<600,left=phone?44:58,right=w-(phone?14:24);
 const top=16,plotH=phone?220:285,bottom=top+plotH,lane=phone?18:16,railTop=bottom+10,railBottom=railTop+lane*LANES.length,h=railBottom+30;
 const X=y=>left+(y-from)/span*(right-left),laneY=c=>railTop+lane*(LANES.indexOf(c)+.5);
 const values=shown.flatMap(p=>[p.nominal,p.CPI,p.MEI]);let lo,hi,tick;
 if(!(Math.max(...values)>0)){lo=0;hi=100;tick=25;}
 else if(full){tick=nice(Math.max(...values)*1.08/4);lo=0;hi=Math.ceil(Math.max(...values)*1.08/tick)*tick;}
 else{const a=Math.min(...values),b=Math.max(...values),pad=Math.max((b-a)*.15,b*.02);tick=nice(b-a+2*pad);lo=Math.max(0,Math.floor((a-pad)/tick)*tick);hi=Math.ceil((b+pad)/tick)*tick;}
 const Y=v=>bottom-plotH*(v-lo)/(hi-lo);
 svg.parentElement.classList.toggle('compact-chart',phone);
 svg.replaceChildren();overlay.replaceChildren();svg.setAttribute('viewBox',`0 0 ${w} ${h}`);svg.style.height=h+'px';svg.dataset.range=`${from}-${to}`;
 add(svg,'title',{id:'chart-title'},`Monthly Medicare payments, ${from} to ${to}`);
 add(svg,'desc',{id:'chart-desc'},`Nominal payments in each year’s dollars, plus CPI-adjusted and MEI-adjusted payments in ${to} dollars, so all three lines meet in ${to}.${from<=1995?' Years up to 1995 are shaded: national reference values without local charge-transition blending.':''}${full?'':' The vertical axis does not start at zero.'} Policy events are markers below the plot, by category. Exact yearly values are in the comparison table and download.`);
 if(from<=1995){add(svg,'rect',{x:X(from),y:top,width:X(Math.min(1995.5,to))-X(from),height:plotH,class:'caveat-band'});add(svg,'text',{x:X(from)+4,y:top+14,class:'caveat-label'},phone?'Ref.':'Reference only');}
 const ticks=Math.min(12,Math.max(1,Math.round((hi-lo)/tick)));for(let i=0;i<=ticks;i++){const v=lo+i*tick;add(svg,'line',{x1:left,x2:right,y1:Y(v),y2:Y(v),class:'grid-line'});add(svg,'text',{x:left-8,y:Y(v)+4,'text-anchor':'end',class:'axis-text'},axis(v));}
 if(!full)add(svg,'text',{x:left,y:top-4,class:'axis-note'},'Axis does not start at $0');
 // Event rail: one lane per category, between the plot and the year labels.
 for(const c of LANES){add(svg,'line',{x1:left,x2:right,y1:laneY(c),y2:laneY(c),class:'rail-line'});add(svg,'text',{x:left-8,y:laneY(c)+3.5,'text-anchor':'end',class:'rail-label'},LANE_LABELS[c]);}
 for(const year of yearTicks(from,to,phone?4:8))add(svg,'text',{x:X(year),y:railBottom+20,'text-anchor':year===from?'start':year===to?'end':'middle',class:'axis-text'},year);
 for(const key of ['CPI','MEI','nominal'])add(svg,'path',{d:shown.map((p,i)=>(i?'L':'M')+X(p.year)+','+Y(p[key])).join(' '),class:'monthly-line '+key});
 if(span<=12)for(const p of shown)add(svg,'circle',{cx:X(p.year),cy:Y(p.nominal),r:3,class:'year-point'});
 const highlight=add(svg,'g',{class:'event-highlight'});
 const cursor=add(svg,'line',{x1:0,x2:0,y1:top,y2:bottom,class:'hover-line',visibility:'hidden'});
 const hit=add(svg,'rect',{x:left,y:top,width:right-left,height:plotH,class:'hover-target'});
 const visible=events.filter(e=>e.year>from&&e.year<=to&&!hidden.has(e.category));
 const place=(html,x,yTop)=>{if(!tooltip)return;tooltip.innerHTML=html;tooltip.hidden=false;const r=svg.getBoundingClientRect(),sx=r.width/w,tw=tooltip.offsetWidth;tooltip.style.left=Math.max(0,Math.min(r.width-tw,x*sx-tw/2))+'px';tooltip.style.top=Math.max(0,yTop*sx-tooltip.offsetHeight-10)+'px';};
 const hide=()=>{if(tooltip)tooltip.hidden=true;cursor.setAttribute('visibility','hidden');highlight.replaceChildren();};
 // Year readout on the plot; mentions any policy event that year.
 const showYear=evt=>{const r=svg.getBoundingClientRect(),sx=(evt.clientX-r.left)*w/r.width,year=Math.max(from,Math.min(to,Math.round(from+(sx-left)/(right-left)*span))),p=points.find(p=>p.year===year),prev=points.find(p=>p.year===year-1);highlight.replaceChildren();cursor.setAttribute('x1',X(year));cursor.setAttribute('x2',X(year));cursor.setAttribute('visibility','visible');const ev=visible.filter(e=>e.year===year);place(`<b>${year}</b><span class="nominal">Nominal ${money(p.nominal)}${prev?` <small>${pct(p.nominal,prev.nominal)} vs ${year-1}</small>`:''}</span><span class="CPI">CPI-adjusted ${money(p.CPI)}</span><span class="MEI">MEI-adjusted ${money(p.MEI)}</span>${ev.map(e=>`<span class="tip-event ${e.category}"><i aria-hidden="true"></i>${esc(e.label)}</span>`).join('')}`,X(year),Y(Math.max(p.nominal,p.CPI,p.MEI)));};
 hit.addEventListener('pointermove',showYear);hit.addEventListener('pointerdown',showYear);hit.addEventListener('pointerleave',hide);
 // Event markers: buttons (keyboard reachable). Hover/focus shows the effect on the line; click opens details.
 const showEvent=e=>{const p=points.find(p=>p.year===e.year),prev=points.find(p=>p.year===e.year-1);cursor.setAttribute('visibility','hidden');highlight.replaceChildren();if(prev&&e.year-1>=from){add(highlight,'rect',{x:X(e.year-1),y:top,width:X(e.year)-X(e.year-1),height:plotH,class:'event-band '+e.category});add(highlight,'path',{d:`M ${X(e.year-1)} ${Y(prev.nominal)} L ${X(e.year)} ${Y(p.nominal)}`,class:'event-segment '+e.category});}add(highlight,'path',{d:`M ${X(e.year)} ${Y(p.nominal)} L ${X(e.year)} ${bottom} L ${pos[e.id]} ${laneY(e.category)}`,class:'event-guide '+e.category});
  place(`<b>${e.year} · ${esc(e.label)}</b><span class="tip-detail">${esc(e.detail)}</span>${e.impact!==undefined?`<span class="tip-impact">This change, ${e.year-1} → ${e.year}: <strong>${signed(e.impact)}</strong> a month</span>`:''}${prev?`<span class="tip-impact${e.impact!==undefined?' tip-total':''}">All changes that year: <strong>${signed(p.nominal-prev.nominal)}</strong> (${pct(p.nominal,prev.nominal)})</span>`:''}`,X(e.year),Math.min(Y(p.nominal),Y(prev?.nominal??p.nominal)));};
 const gap=phone?18:20,pos={};for(const c of LANES){const items=visible.filter(e=>e.category===c).sort((a,b)=>a.year-b.year),xs=items.map(e=>X(e.year));for(let i=1;i<xs.length;i++)xs[i]=Math.max(xs[i],xs[i-1]+gap);for(let i=xs.length-1;i>=0;i--){const max=i===xs.length-1?right:xs[i+1]-gap;if(xs[i]>max)xs[i]=max;}items.forEach((e,i)=>pos[e.id]=xs[i]);}
 for(const e of visible){const b=document.createElement('button');b.type='button';b.className=`event-marker ${e.category}`;b.dataset.id=e.id;b.dataset.year=e.year;b.setAttribute('aria-label',`${e.year}: ${e.label}. ${e.detail} Open details`);b.setAttribute('aria-haspopup','dialog');b.style.left=pos[e.id]+'px';b.style.top=laneY(e.category)+'px';b.style.width=b.style.height=Math.min(24,gap,lane+2)+'px';b.style.margin=`-${Math.min(24,gap,lane+2)/2}px 0 0 -${Math.min(24,gap,lane+2)/2}px`;b.onclick=()=>onOpen(e,b);b.onmouseenter=b.onfocus=()=>showEvent(e);b.onmouseleave=b.onblur=hide;overlay.append(b);}
}
