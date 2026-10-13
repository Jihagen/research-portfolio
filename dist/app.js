const DATA = 'data/homonym/';
const url = { layers: DATA + 'layer_separation.json', geometry: DATA + 'geometry_by_layer.json', landscapes: DATA + 'garden_path_landscapes.json', priors: DATA + 'prior_heatmap.json' };
const $ = id => document.getElementById(id);
const opt = (value, label = value) => Object.assign(document.createElement('option'), { value, textContent: label });
const human = value => String(value).replaceAll('_', ' ').replaceAll('-', ' ');
const fmt = (value, digits = 3) => `${Number(value) >= 0 ? '+' : ''}${Number(value).toFixed(digits)}`;
const esc = value => String(value).replace(/[&<>]/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;' }[ch]));
const colours = { sense0:'#243a91', sense1:'#d67322', conflict:'#b24a48', coherent:'#32745e', terrain:'#aeb3af' };

let layerData, geometryData, landscapeData, priorData, activeLayer = 0;
let trajectoryView = { yaw: -0.76, pitch: 0.40, zoom: 1 };

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
  const model=$('trajectoryModel'), models=Object.keys(landscapeData.cells); model.replaceChildren(...models.map(m=>opt(m,human(m)))); model.value=models.includes('Qwen_Qwen2.5-7B')?'Qwen_Qwen2.5-7B':models[0];
  refreshTrajectoryWords(); model.addEventListener('change',refreshTrajectoryWords); $('trajectoryWord').addEventListener('change',refreshTrajectoryItems); $('trajectoryItem').addEventListener('change',drawTrajectory);
  const svg=$('trajectoryChart'); let start;
  svg.addEventListener('pointerdown',event=>{start={x:event.clientX,y:event.clientY,yaw:trajectoryView.yaw,pitch:trajectoryView.pitch};svg.setPointerCapture(event.pointerId);svg.classList.add('rotating');});
  svg.addEventListener('pointermove',event=>{if(!start)return;trajectoryView.yaw=start.yaw+(event.clientX-start.x)*.012;trajectoryView.pitch=Math.max(-1.25,Math.min(1.25,start.pitch+(event.clientY-start.y)*.008));drawTrajectory();});
  svg.addEventListener('pointerup',()=>{start=null;svg.classList.remove('rotating');});
  svg.addEventListener('wheel',event=>{event.preventDefault();trajectoryView.zoom=Math.max(.75,Math.min(3,trajectoryView.zoom*(event.deltaY<0?1.12:.89)));drawTrajectory();},{passive:false});
  $('trajectoryZoomIn').addEventListener('click',()=>{trajectoryView.zoom=Math.min(3,trajectoryView.zoom*1.2);drawTrajectory();});
  $('trajectoryZoomOut').addEventListener('click',()=>{trajectoryView.zoom=Math.max(.75,trajectoryView.zoom/1.2);drawTrajectory();});
  $('trajectoryViewReset').addEventListener('click',()=>{trajectoryView={yaw:-0.76,pitch:.40,zoom:1};drawTrajectory();});
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

Promise.all([loadGeometry(), loadLandscapes(), loadPriors()]).catch(error=>{ console.error(error); document.querySelectorAll('svg').forEach(svg=>svg.insertAdjacentHTML('afterend','<p class="figure-note">The released data could not be loaded. Please use the repository link above.</p>')); });
