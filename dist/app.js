const DATA = 'data/homonym/';
const url = { layers: DATA + 'layer_separation.json', geometry: DATA + 'geometry_by_layer.json', landscapes: DATA + 'garden_path_landscapes.json', priors: DATA + 'prior_heatmap.json' };
const $ = id => document.getElementById(id);
const opt = (value, label = value) => Object.assign(document.createElement('option'), { value, textContent: label });
const human = value => String(value).replaceAll('_', ' ').replaceAll('-', ' ');
const fmt = (value, digits = 3) => `${Number(value) >= 0 ? '+' : ''}${Number(value).toFixed(digits)}`;
const esc = value => String(value).replace(/[&<>]/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;' }[ch]));
const colours = { sense0:'#243a91', sense1:'#d67322', conflict:'#b24a48', coherent:'#32745e', terrain:'#aeb3af' };

let layerData, geometryData, landscapeData, priorData, activeLayer = 0;
let trajectoryView = { yaw: 0, pitch: 0, zoom: 1 };

function extent(points, key, pad = .08) {
  const values = points.map(key), lo = Math.min(...values), hi = Math.max(...values), edge = (hi - lo || 1) * pad;
  return [lo - edge, hi + edge];
}
function rotate(point, yaw, pitch) {
  const [x,y,z] = point, cx = Math.cos(yaw), sx = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  const rx = cx * x - sx * y, ry = sx * x + cx * y;
  return [rx, cp * ry - sp * z, sp * ry + cp * z];
}
function project3D(points, W, H, padding, yaw, pitch, zoom = 1) {
  const rotated = points.map(p => rotate(p, yaw, pitch)), [x0,x1] = extent(rotated, p => p[0], .13), [y0,y1] = extent(rotated, p => p[1], .13);
  const scale = Math.min((W-padding.l-padding.r)/(x1-x0 || 1), (H-padding.t-padding.b)/(y1-y0 || 1)) * zoom, cx=(x0+x1)/2, cy=(y0+y1)/2;
  return rotated.map(p => [W/2+(p[0]-cx)*scale, H/2-(p[1]-cy)*scale, p[2]]);
}
function chartGrid(W,H,p) {
  let h='';
  for(let i=0;i<5;i++) { const x=p.l+(W-p.l-p.r)*i/4, y=p.t+(H-p.t-p.b)*i/4; h += `<line class="grid" x1="${x}" x2="${x}" y1="${p.t}" y2="${H-p.b}"/><line class="grid" x1="${p.l}" x2="${W-p.r}" y1="${y}" y2="${y}"/>`; }
  return h;
}
function lineChart(values, metric, selectedLayer) {
  const svg = $('homonymChart'), W=680,H=330,p={l:49,r:18,t:20,b:35}, xs = values.layers, ys = values[metric];
  const rawMin = metric === 'fraction_adequate' ? 0 : Math.min(...ys), rawMax = metric === 'fraction_adequate' ? 1 : Math.max(...ys);
  const d=(rawMax-rawMin||1)*.13, min=rawMin-d,max=rawMax+d, x = v => p.l + (v-xs[0])/(xs.at(-1)-xs[0]||1)*(W-p.l-p.r), y=v=>H-p.b-(v-min)/(max-min)*(H-p.t-p.b);
  let h=chartGrid(W,H,p);
  for(let i=0;i<5;i++){ const yy=p.t+(H-p.t-p.b)*i/4, val=max-(max-min)*i/4; h += `<text class="axis" x="${p.l-9}" y="${yy+4}" text-anchor="end">${val.toFixed(2)}</text>`; }
  if(min < 0 && max > 0) h += `<line class="zero" x1="${p.l}" x2="${W-p.r}" y1="${y(0)}" y2="${y(0)}"/>`;
  h += `<path d="${xs.map((v,i)=>`${i?'L':'M'}${x(v)},${y(ys[i])}`).join(' ')}" fill="none" stroke="${colours.sense0}" stroke-width="3"/>`;
  h += xs.map((v,i)=>`<circle cx="${x(v)}" cy="${y(ys[i])}" r="2.8" fill="${colours.sense0}"/>`).join('');
  const index = xs.indexOf(selectedLayer);
  if(index >= 0) h += `<line class="selected-layer" x1="${x(selectedLayer)}" x2="${x(selectedLayer)}" y1="${p.t}" y2="${H-p.b}"/><circle cx="${x(selectedLayer)}" cy="${y(ys[index])}" r="6" fill="white" stroke="${colours.sense0}" stroke-width="3"/>`;
  svg.innerHTML=h+`<text class="axis" x="${p.l}" y="${H-9}">L${xs[0]}</text><text class="axis" x="${W-p.r}" y="${H-9}" text-anchor="end">L${xs.at(-1)}</text>`;
}
function drawGeometry() {
  const model=$('homonymModel').value, word=$('homonymWord').value, lcell=layerData.cells[model][word], gcell=geometryData.cells[model][word];
  activeLayer = Number($('geometryLayer').value);
  const record=gcell.layers.find(d=>d.layer===activeLayer) || gcell.layers[0], metric=$('curveMetric').value;
  lineChart(lcell, metric, activeLayer);
  $('curveCaption').textContent=`L${activeLayer} · ${({mean_margin_norm:'normalised margin', gdv:'GDV', fraction_adequate:'fraction adequate'})[metric]}`;
  $('geometryLayerValue').textContent=`L${activeLayer}`; $('geometryCaption').textContent=`${human(model)} · ${word} · L${activeLayer}`;
  const W=520,H=330,p={l:25,r:22,t:15,b:25}, projected=project3D(record.profile_points,W,H,p,-0.62,.39);
  let h='';
  [[0,'sense 1'],[1,'sense 2']].forEach(([sense,label])=>{ const list=projected.filter((_,i)=>record.profile_senses[i]===sense), cx=list.reduce((s,v)=>s+v[0],0)/list.length,cy=list.reduce((s,v)=>s+v[1],0)/list.length; h += `<circle cx="${cx}" cy="${cy}" r="11" fill="none" stroke="${sense?colours.sense1:colours.sense0}" stroke-width="1.4"/><text class="axis" x="${cx+13}" y="${cy-10}">${label}</text>`; });
  projected.map((point,i)=>({point,i})).sort((a,b)=>a.point[2]-b.point[2]).forEach(({point,i})=>{ const sense=record.profile_senses[i]; h+=`<circle cx="${point[0]}" cy="${point[1]}" r="4" fill="${sense?colours.sense1:colours.sense0}" fill-opacity=".74"/>`; });
  $('geometryChart').innerHTML=h+`<text class="axis" x="${W/2}" y="${H-7}" text-anchor="middle">Shared PCA display projection · PC1 / PC2 / PC3</text>`;
  $('geometryNote').textContent=`Full-space GDV ${record.gdv_full_space.toFixed(3)} · adequacy ${(record.fraction_adequate_full_space*100).toFixed(1)}%. Display coordinates are within-layer standardised; absolute cloud size is not comparable across layers.`;
}
function refreshGeometryWords() {
  const model=$('homonymModel').value, words=Object.keys(layerData.cells[model]), w=$('homonymWord');
  w.replaceChildren(...words.map(word=>opt(word,word))); w.value=words.includes('bank')?'bank':words[0]; refreshGeometryLayers();
}
function refreshGeometryLayers() {
  const model=$('homonymModel').value, word=$('homonymWord').value, cell=geometryData.cells[model][word], range=$('geometryLayer'), preferred=Math.min(cell.last_layer, layerData.cells[model][word].selected_layer_gdv);
  range.max=cell.last_layer; range.value=preferred; activeLayer=preferred; drawGeometry();
}
async function loadGeometry() {
  [layerData, geometryData] = await Promise.all([fetch(url.layers).then(r=>r.json()), fetch(url.geometry).then(r=>r.json())]);
  const model=$('homonymModel'), models=Object.keys(layerData.cells);
  model.replaceChildren(...models.map(m=>opt(m,human(m)))); model.value=models.includes('Qwen_Qwen2.5-7B')?'Qwen_Qwen2.5-7B':models[0];
  refreshGeometryWords();
  model.addEventListener('change',refreshGeometryWords); $('homonymWord').addEventListener('change',refreshGeometryLayers); $('curveMetric').addEventListener('change',drawGeometry); $('geometryLayer').addEventListener('input',drawGeometry);
}

function landscapeCell() { return landscapeData.cells[$('trajectoryModel').value][$('trajectoryWord').value]; }
function selectedLandscapeItem() { return landscapeCell().items.find(item=>item.item_id===$('trajectoryItem').value); }
function terrainPoints(cell) {
  const grid=cell.landscape, zMax=Math.max(...grid.total_density.flat()), terrain=[];
  grid.y.forEach((y,iy)=>grid.x.forEach((x,ix)=>terrain.push([x,y,-1.15+grid.total_density[iy][ix]/zMax*.36])));
  return terrain;
}
function renderTerrain(cell, coords) {
  const grid=cell.landscape, zMax=Math.max(...grid.total_density.flat()), point=(iy,ix)=>coords[iy*grid.x.length+ix]; let h='';
  for(let iy=0;iy<grid.y.length-1;iy+=2){for(let ix=0;ix<grid.x.length-1;ix+=2){const a=point(iy,ix),b=point(iy,Math.min(ix+2,grid.x.length-1)),c=point(Math.min(iy+2,grid.y.length-1),Math.min(ix+2,grid.x.length-1)),d=point(Math.min(iy+2,grid.y.length-1),ix), total=grid.total_density[iy][ix], den=total/zMax, blue=grid.sense_0_density[iy][ix], orange=grid.sense_1_density[iy][ix], share=total?orange/total:.5, r=Math.round(36+(214-36)*share), g=Math.round(58+(115-58)*share), bcol=Math.round(145+(34-145)*share); h+=`<path d="M${a[0]},${a[1]}L${b[0]},${b[1]}L${c[0]},${c[1]}L${d[0]},${d[1]}Z" fill="rgb(${r},${g},${bcol})" fill-opacity="${.03+den*.37}" stroke="rgb(${r},${g},${bcol})" stroke-opacity="${.04+den*.24}" stroke-width=".7"/>`;}}
  return h;
}
function drawTrajectory() {
  const cell=landscapeCell(), item=selectedLandscapeItem(), W=1080,H=520,p={l:28,r:24,t:22,b:36}, profile=cell.profile.points, conflicting=item.conflicting.points, coherent=item.coherent_control.points, allPoints=[...profile,...conflicting,...coherent];
  const terrain=terrainPoints(cell), transformed=project3D([...allPoints,...terrain],W,H,p,trajectoryView.yaw,trajectoryView.pitch,trajectoryView.zoom), profileT=transformed.slice(0,profile.length), conflictT=transformed.slice(profile.length,profile.length+3), coherentT=transformed.slice(profile.length+3,profile.length+6), terrainT=transformed.slice(allPoints.length);
  const centroidT=[0,1].map(sense=>{const points=profileT.filter((_,i)=>cell.profile.senses[i]===sense);return [points.reduce((sum,point)=>sum+point[0],0)/points.length,points.reduce((sum,point)=>sum+point[1],0)/points.length];});
  let h=renderTerrain(cell,terrainT);
  profileT.forEach((point,i)=>h+=`<circle cx="${point[0]}" cy="${point[1]}" r="3.5" fill="${cell.profile.senses[i]?colours.sense1:colours.sense0}" opacity=".37"/>`);
  centroidT.forEach((point,i)=>h+=`<path class="centroid" d="M${point[0]-6},${point[1]}h12M${point[0]},${point[1]-6}v12"/><text class="axis" x="${point[0]+9}" y="${point[1]-8}">sense ${i+1}</text>`);
  const pathFor=(points, colour, dash='')=>points.slice(1).map((point,index)=>{const start=points[index];return `<line x1="${start[0]}" y1="${start[1]}" x2="${point[0]}" y2="${point[1]}" stroke="${colour}" stroke-width="5" stroke-linecap="round" ${dash?`stroke-dasharray="${dash}"`:''}/><path d="M${start[0]},${start[1]}L${point[0]},${point[1]}" fill="none" stroke="${colour}" stroke-width="1" marker-end="url(#arrow-${colour.slice(1)})"/>`;}).join('');
  h += pathFor(conflictT,colours.conflict) + pathFor(coherentT,colours.coherent,'8 5');
  conflictT.forEach((point,i)=>h+=`<circle cx="${point[0]}" cy="${point[1]}" r="6" fill="${colours.conflict}"/><text class="stage-label" x="${point[0]+9}" y="${point[1]-9}">${['prime','homonym','resolver'][i]}</text>`);
  coherentT.forEach((point,i)=>h+=`<circle cx="${point[0]}" cy="${point[1]}" r="5.2" fill="white" stroke="${colours.coherent}" stroke-width="3"/><text class="stage-label coherent-stage" x="${point[0]+9}" y="${point[1]+13}">${['prime','homonym','resolver'][i]}</text>`);
  h = `<defs><marker id="arrow-b24a48" markerWidth="8" markerHeight="8" refX="6.5" refY="4" orient="auto"><path d="M0,0L8,4L0,8Z" fill="${colours.conflict}"/></marker><marker id="arrow-32745e" markerWidth="8" markerHeight="8" refX="6.5" refY="4" orient="auto"><path d="M0,0L8,4L0,8Z" fill="${colours.coherent}"/></marker></defs>`+h;
  $('trajectoryChart').innerHTML=h; $('trajectoryCaption').textContent=`${human($('trajectoryModel').value)} · ${$('trajectoryWord').value} · analysis layer ${cell.analysis_layer}`; $('trajectoryZoom').textContent=`${Math.round(trajectoryView.zoom*100)}%`;
  $('stageReadout').innerHTML=`<b>Garden path:</b> ${esc(item.conflicting.stage_text[0])} → ${esc(item.conflicting.stage_text[1])} → ${esc(item.conflicting.stage_text[2])}<br><b>Coherent:</b> ${esc(item.coherent_control.stage_text[0])} → ${esc(item.coherent_control.stage_text[1])} → ${esc(item.coherent_control.stage_text[2])}<br><span class="margin-readout">Correct-sense margin at resolver: garden path ${fmt(item.conflicting.full_space_correct_margins[2])} · coherent ${fmt(item.coherent_control.full_space_correct_margins[2])}</span>`;
}
function refreshTrajectoryWords() {
  const model=$('trajectoryModel').value, words=Object.keys(landscapeData.cells[model]), select=$('trajectoryWord');
  select.replaceChildren(...words.map(w=>opt(w,w))); select.value=words.includes('bank')?'bank':words[0]; refreshTrajectoryItems();
}
function refreshTrajectoryItems() {
  const cell=landscapeCell(), safe=cell.items.filter(item=>!item.coherent_control.resolver_side_differs_from_released_table), select=$('trajectoryItem');
  select.replaceChildren(...safe.map(item=>opt(item.item_id,`${item.item_id.replaceAll('_',' ').toUpperCase()} · ${item.resolution_word}`))); select.value=cell.default_item_id; drawTrajectory();
}
async function loadLandscapes() {
  landscapeData=await fetch(url.landscapes).then(r=>r.json());
  const model=$('trajectoryModel'), models=Object.keys(landscapeData.cells); model.replaceChildren(...models.map(m=>opt(m,human(m)))); model.value=models.includes('FacebookAI_roberta-large')?'FacebookAI_roberta-large':models[0];
  refreshTrajectoryWords(); model.addEventListener('change',refreshTrajectoryWords); $('trajectoryWord').addEventListener('change',refreshTrajectoryItems); $('trajectoryItem').addEventListener('change',drawTrajectory);
  const svg=$('trajectoryChart'); let start;
  svg.addEventListener('pointerdown',event=>{start={x:event.clientX,y:event.clientY,yaw:trajectoryView.yaw,pitch:trajectoryView.pitch};svg.setPointerCapture(event.pointerId);svg.classList.add('rotating');});
  svg.addEventListener('pointermove',event=>{if(!start)return;trajectoryView.yaw=start.yaw+(event.clientX-start.x)*.012;trajectoryView.pitch=Math.max(-1.25,Math.min(1.25,start.pitch+(event.clientY-start.y)*.008));drawTrajectory();});
  svg.addEventListener('pointerup',()=>{start=null;svg.classList.remove('rotating');});
  svg.addEventListener('wheel',event=>{event.preventDefault();trajectoryView.zoom=Math.max(.75,Math.min(3,trajectoryView.zoom*(event.deltaY<0?1.12:.89)));drawTrajectory();},{passive:false});
  $('trajectoryZoomIn').addEventListener('click',()=>{trajectoryView.zoom=Math.min(3,trajectoryView.zoom*1.2);drawTrajectory();});
  $('trajectoryZoomOut').addEventListener('click',()=>{trajectoryView.zoom=Math.max(.75,trajectoryView.zoom/1.2);drawTrajectory();});
  $('trajectoryViewReset').addEventListener('click',()=>{trajectoryView={yaw:0,pitch:0,zoom:1};drawTrajectory();});
}

function drawPriors() {
  const bare=$('priorCondition').value==='bare', values=bare?priorData.bare_word_lean:priorData.carrier_mean_lean, models=priorData.models, words=priorData.words, W=1080,H=470,p={l:205,r:20,t:38,b:40}, cw=(W-p.l-p.r)/words.length,ch=(H-p.t-p.b)/models.length, max=Math.max(...values.flat().map(Math.abs))||1;
  let h='';
  models.forEach((model,row)=>{h+=`<text class="heat-label" x="${p.l-12}" y="${p.t+ch*(row+.5)+4}" text-anchor="end">${human(model)}</text>`; words.forEach((word,col)=>{const v=values[row][col], ratio=Math.min(1,Math.abs(v)/max), color=v>=0?`rgba(36,58,145,${.1+.8*ratio})`:`rgba(214,115,34,${.1+.8*ratio})`;h+=`<rect x="${p.l+col*cw+1}" y="${p.t+row*ch+1}" width="${cw-2}" height="${ch-2}" fill="${color}"/><text class="heat-value" x="${p.l+col*cw+cw/2}" y="${p.t+row*ch+ch/2+4}" text-anchor="middle">${v.toFixed(2)}</text>`;});});
  words.forEach((word,col)=>h+=`<text class="axis" x="${p.l+col*cw+cw/2}" y="${p.t-12}" text-anchor="middle">${word}</text>`);
  $('priorChart').innerHTML=h+`<text class="axis" x="${p.l}" y="${H-10}">orange: closer to sense 2</text><text class="axis" x="${W-p.r}" y="${H-10}" text-anchor="end">blue: closer to sense 1</text>`;
  $('priorCaption').textContent=bare?'Bare-word state at the released H0 layer':'Mean across five ambiguous carrier sentences at the released H0 layer';
}
async function loadPriors() { priorData=await fetch(url.priors).then(r=>r.json()); drawPriors(); $('priorCondition').addEventListener('change',drawPriors); }

/* Garden-path landscape: a dense, top-down PCA display with an optional depth view. */
const gardenColours={sense0:'#4A3AA7',sense1:'#D59A18',conflict:'#242329',coherent:'#1B998B',neutral:'#F5F2EC'};
const gardenSenseLabels={
  bank:['River / embankment','Financial institution'],bark:['Sound a dog makes','Outer layer of a tree'],bat:['Sports equipment','Flying mammal'],
  crane:['Large wading bird','Construction lifting machine'],spring:['Season (after winter)','Natural spring / water source'],
  match:['Sporting contest','Fire-starting stick'],pitch:['Sports playing field','Business proposal / investor presentation']
};
const hexRgb=hex=>{const n=parseInt(hex.slice(1),16);return[(n>>16)&255,(n>>8)&255,n&255]};
const mixRgb=(a,b,t)=>a.map((v,i)=>Math.round(v+(b[i]-v)*t));
function gardenDensity(point,points,h){return points.reduce((total,p)=>total+Math.exp(-((point[0]-p[0])**2+(point[1]-p[1])**2)/(2*h*h)),0)/(points.length*2*Math.PI*h*h)}
function gardenField(cell,item){
  const h=cell.landscape.bandwidth, profile0=cell.profile.points.filter((_,i)=>cell.profile.senses[i]===0).map(p=>p.slice(0,2)),profile1=cell.profile.points.filter((_,i)=>cell.profile.senses[i]===1).map(p=>p.slice(0,2));
  const raw=[...cell.profile.points,...item.conflicting.points,...item.coherent_control.points].map(p=>p.slice(0,2));
  const x0=Math.min(...raw.map(p=>p[0]))-3*h,x1=Math.max(...raw.map(p=>p[0]))+3*h,y0=Math.min(...raw.map(p=>p[1]))-3*h,y1=Math.max(...raw.map(p=>p[1]))+3*h;
  const coarse=[],n0=61; let coarsePeak=0;
  for(let iy=0;iy<n0;iy++)for(let ix=0;ix<n0;ix++){const x=x0+(x1-x0)*ix/(n0-1),y=y0+(y1-y0)*iy/(n0-1),d0=gardenDensity([x,y],profile0,h),d1=gardenDensity([x,y],profile1,h),total=.5*(d0+d1);coarse.push([x,y,total]);coarsePeak=Math.max(coarsePeak,total)}
  const focus=coarse.filter(point=>point[2]/coarsePeak>.12).concat([...item.conflicting.points,...item.coherent_control.points].map(p=>[p[0],p[1],0]));
  const fx0=Math.min(...focus.map(p=>p[0]))-1.3*h,fx1=Math.max(...focus.map(p=>p[0]))+1.3*h,fy0=Math.min(...focus.map(p=>p[1]))-1.3*h,fy1=Math.max(...focus.map(p=>p[1]))+1.3*h;
  const n=91,values=[],points=[]; let peak=0;
  for(let iy=0;iy<n;iy++){values[iy]=[];for(let ix=0;ix<n;ix++){const x=fx0+(fx1-fx0)*ix/(n-1),y=fy0+(fy1-fy0)*iy/(n-1),d0=gardenDensity([x,y],profile0,h),d1=gardenDensity([x,y],profile1,h),total=.5*(d0+d1);values[iy][ix]={d0,d1,total};peak=Math.max(peak,total)}}
  for(let iy=0;iy<n;iy++)for(let ix=0;ix<n;ix++){const x=fx0+(fx1-fx0)*ix/(n-1),y=fy0+(fy1-fy0)*iy/(n-1),v=values[iy][ix];v.norm=v.total/peak;points.push([x,y,-v.norm])}
  const at=point=>{const d0=gardenDensity(point,profile0,h),d1=gardenDensity(point,profile1,h);return{d0,d1,norm:.5*(d0+d1)/peak}};
  return{n,values,points,at,frame:[fx0,fx1,fy0,fy1]};
}
function gardenContours(field,coords){
  const result=[],at=(iy,ix)=>coords[iy*field.n+ix];
  [.1,.2,.3,.4,.5,.6,.7,.8,.9].forEach((level,index)=>{let labelled=false;for(let iy=0;iy<field.n-1;iy++)for(let ix=0;ix<field.n-1;ix++){
    const values=[field.values[iy][ix].norm,field.values[iy][ix+1].norm,field.values[iy+1][ix+1].norm,field.values[iy+1][ix].norm],points=[at(iy,ix),at(iy,ix+1),at(iy+1,ix+1),at(iy+1,ix)],edges=[[0,1],[1,2],[2,3],[3,0]],hits=[];
    edges.forEach(([from,to])=>{if((values[from]>=level)!==(values[to]>=level)){const t=(level-values[from])/(values[to]-values[from]);hits.push([points[from][0]+(points[to][0]-points[from][0])*t,points[from][1]+(points[to][1]-points[from][1])*t])}});
    if(hits.length===2){result.push(`<path class="terrain-contour" d="M${hits[0][0]},${hits[0][1]}L${hits[1][0]},${hits[1][1]}"/>`);if(index%2===1&&!labelled&&ix>6&&iy>6){result.push(`<text class="terrain-label" x="${hits[0][0]+3}" y="${hits[0][1]-3}">−${level.toFixed(1)}</text>`);labelled=true}}
  }});return result.join('');
}
function gardenMesh(field,coords){
  const at=(iy,ix)=>coords[iy*field.n+ix],purple=hexRgb(gardenColours.sense0),amber=hexRgb(gardenColours.sense1),neutral=hexRgb(gardenColours.neutral);let svg='';
  for(let iy=0;iy<field.n-2;iy+=2)for(let ix=0;ix<field.n-2;ix+=2){const a=at(iy,ix),b=at(iy,ix+2),c=at(iy+2,ix+2),d=at(iy+2,ix),v=field.values[iy][ix],share=v.total?v.d0/(v.d0+v.d1):.5,hue=mixRgb(amber,purple,share),colour=mixRgb(neutral,hue,Math.pow(v.norm,.6));svg+=`<path d="M${a[0]},${a[1]}L${b[0]},${b[1]}L${c[0]},${c[1]}L${d[0]},${d[1]}Z" fill="rgb(${colour})" stroke="rgb(${colour})" stroke-width=".55"/>`}
  return svg+gardenContours(field,coords);
}
function drawGardenMargins(item,labels){
  const W=410,H=520,p={l:55,r:20,t:42,b:66},all=[...item.conflicting.full_space_correct_margins,...item.coherent_control.full_space_correct_margins],max=Math.max(.15,...all.map(value=>Math.abs(value)*1.25)),x=i=>p.l+i*(W-p.l-p.r)/2,y=value=>p.t+(max-value)/(2*max)*(H-p.t-p.b),zero=y(0);
  let svg=`<rect x="${p.l}" y="${p.t}" width="${W-p.l-p.r}" height="${zero-p.t}" fill="${gardenColours.sense0}" opacity=".10"/><rect x="${p.l}" y="${zero}" width="${W-p.l-p.r}" height="${H-p.b-zero}" fill="${gardenColours.sense1}" opacity=".14"/>`;
  [-max,-max/2,0,max/2,max].forEach(value=>svg+=`<line class="${value===0?'margin-zero':'margin-grid'}" x1="${p.l}" x2="${W-p.r}" y1="${y(value)}" y2="${y(value)}"/><text class="axis" x="${p.l-9}" y="${y(value)+4}" text-anchor="end">${fmt(value,2)}</text>`);
  svg+=`<text class="margin-side-label" x="${W-p.r-4}" y="${p.t+16}" text-anchor="end">${esc(labels[item.target_sense])}</text><text class="margin-side-label" x="${W-p.r-4}" y="${H-p.b-11}" text-anchor="end">${esc(labels[1-item.target_sense])}</text><text class="margin-boundary" x="${p.l+7}" y="${zero-7}">decision boundary</text>`;
  const draw=(values,colour,dash='')=>{const d=`M${values.map((value,i)=>`${x(i)},${y(value)}`).join('L')}`;svg+=`<path d="${d}" fill="none" stroke="white" stroke-width="7" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${colour}" stroke-width="3" stroke-linecap="round" ${dash?`stroke-dasharray="${dash}"`:''}/>`;values.forEach((value,i)=>svg+=`<circle cx="${x(i)}" cy="${y(value)}" r="${4+i*1.1}" fill="${dash?'white':colour}" stroke="${colour}" stroke-width="2.2"/>`)};
  draw(item.conflicting.full_space_correct_margins,gardenColours.conflict);draw(item.coherent_control.full_space_correct_margins,gardenColours.coherent,'7 4');
  ['prime','homonym','resolver'].forEach((stage,i)=>svg+=`<text class="axis" x="${x(i)}" y="${H-28}" text-anchor="middle">${stage}</text><text class="stage-number" x="${x(i)}" y="${H-10}" text-anchor="middle">${i+1}</text>`);
  $('marginChart').innerHTML=svg;
  const crosses=item.conflicting.full_space_correct_margins[1]<0&&item.conflicting.full_space_correct_margins[2]>0,coherentTarget=item.coherent_control.full_space_correct_margins[2]>0;
  $('boundaryReadout').innerHTML=`<div><b>Garden path</b><span class="${crosses?'crossed':'not-crossed'}">${crosses?'Crosses the decision boundary':'Does not cross the decision boundary'}</span><small>Resolver ${fmt(item.conflicting.full_space_correct_margins[2],4)}</small></div><div><b>Coherent context</b><span class="${coherentTarget?'crossed':'not-crossed'}">${coherentTarget?'Ends on the target side':'Ends on the alternative side'}</span><small>Resolver ${fmt(item.coherent_control.full_space_correct_margins[2],4)}</small></div>`;
}
function drawTrajectory(){
  const cell=landscapeCell(),item=selectedLandscapeItem(),labels=gardenSenseLabels[$('trajectoryWord').value]||['Sense 1','Sense 2'],field=gardenField(cell,item),W=720,H=520,p={l:25,r:24,t:22,b:28},lift=point=>{const d=field.at(point);return[point[0],point[1],-d.norm+.045]},terrain=field.points,profile=cell.profile.points,profile3=profile.map(lift),conflict3=item.conflicting.points.map(lift),coherent3=item.coherent_control.points.map(lift),centroid3=cell.profile.centroids.map(lift);
  const projected=project3D([...terrain,...profile3,...conflict3,...coherent3,...centroid3],W,H,p,trajectoryView.yaw,trajectoryView.pitch,trajectoryView.zoom),terrainT=projected.slice(0,terrain.length),profileT=projected.slice(terrain.length,terrain.length+profile.length),conflictT=projected.slice(terrain.length+profile.length,terrain.length+profile.length+3),coherentT=projected.slice(terrain.length+profile.length+3,terrain.length+profile.length+6),centroidT=projected.slice(-2);
  let svg=`<defs><marker id="arrow-garden" markerWidth="8" markerHeight="8" refX="6.5" refY="4" orient="auto"><path d="M0,0L8,4L0,8Z" fill="${gardenColours.conflict}"/></marker><marker id="arrow-coherent" markerWidth="8" markerHeight="8" refX="6.5" refY="4" orient="auto"><path d="M0,0L8,4L0,8Z" fill="${gardenColours.coherent}"/></marker></defs>`+gardenMesh(field,terrainT);
  const [fx0,fx1,fy0,fy1]=field.frame;let outside=0;profileT.forEach((point,i)=>{const raw=profile[i];if(raw[0]<fx0||raw[0]>fx1||raw[1]<fy0||raw[1]>fy1){outside++;return}svg+=`<circle cx="${point[0]}" cy="${point[1]}" r="3.4" fill="${cell.profile.senses[i]?gardenColours.sense1:gardenColours.sense0}" stroke="white" stroke-width=".75" opacity=".82"/>`});
  centroidT.forEach((point,i)=>svg+=`<path class="centroid garden-centroid" d="M${point[0]-8},${point[1]-8}L${point[0]+8},${point[1]+8}M${point[0]+8},${point[1]-8}L${point[0]-8},${point[1]+8}" stroke="${i?gardenColours.sense1:gardenColours.sense0}"/><text class="landscape-sense-label" x="${point[0]+10}" y="${point[1]-9}">${esc(labels[i])}</text>`);
  const drawPath=(points,colour,marker,dash='',offset=0,hollow=false)=>{points.slice(1).forEach((point,i)=>{const start=points[i];svg+=`<line x1="${start[0]}" y1="${start[1]}" x2="${point[0]}" y2="${point[1]}" stroke="white" stroke-width="7" stroke-linecap="round"/><path d="M${start[0]},${start[1]}L${point[0]},${point[1]}" fill="none" stroke="${colour}" stroke-width="2.7" stroke-linecap="round" ${dash?`stroke-dasharray="${dash}"`:''} marker-end="url(#${marker})"/>`});points.forEach((point,i)=>{const r=4.1+i*1.35;svg+=`<circle cx="${point[0]}" cy="${point[1]}" r="${r}" fill="${hollow?'white':colour}" stroke="${colour}" stroke-width="2.2"/><text class="path-stage-number" x="${point[0]}" y="${point[1]-11+offset}" text-anchor="middle" fill="${colour}">${i+1}</text>`})};
  drawPath(conflictT,gardenColours.conflict,'arrow-garden');drawPath(coherentT,gardenColours.coherent,'arrow-coherent','7 4',17,true);
  $('trajectoryChart').innerHTML=svg;$('trajectoryTitle').textContent=`Garden path versus coherent context on the sense landscape: ${human($('trajectoryModel').value)}, “${$('trajectoryWord').value}”, layer ${cell.analysis_layer}`;$('trajectoryCaption').textContent=`Top-down PC1–PC2 view · ${Math.round((cell.projection.explained_variance_ratio[0]+cell.projection.explained_variance_ratio[1])*100)}% of profile variance`;$('trajectoryZoom').textContent=`${Math.round(trajectoryView.zoom*100)}%`;$('senseZeroLabel').textContent=labels[0];$('senseOneLabel').textContent=labels[1];
  $('stageReadout').innerHTML=`<p><b class="garden-path-name">Garden path</b>${esc(item.conflicting_sentence)}</p><p><b class="coherent-path-name">Coherent context</b>${esc(item.coherent_control_sentence)}</p>`;$('trajectoryNote').textContent=`1 prime, 2 homonym, 3 resolver. Depth is the negative density of the 40 profile sentences in the PC1–PC2 plane (${Math.round((cell.projection.explained_variance_ratio[0]+cell.projection.explained_variance_ratio[1])*100)}% of profile variance), scaled so the deepest well is −1: a display aid, not a model energy. X = sense centroid.${outside?` ${outside} profile point${outside===1?'':'s'} fall outside this focused frame.`:''}`;drawGardenMargins(item,labels);
}

Promise.all([loadGeometry(), loadLandscapes(), loadPriors()]).catch(error=>{ console.error(error); document.querySelectorAll('svg').forEach(svg=>svg.insertAdjacentHTML('afterend','<p class="figure-note">The released data could not be loaded. Please use the repository link above.</p>')); });
