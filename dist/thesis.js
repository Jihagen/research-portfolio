const discoveryCsv = 'data/layerwise_family_summary.csv';
const modes = {
  states: {
    title: 'Affective and evaluative directions',
    families: [
      ['emotion_one_vs_rest', 'Emotion', '#32745e'],
      ['mental_workload', 'Mental workload', '#d67322'],
      ['interestingness', 'Interestingness', '#243a91']
    ]
  },
  identity: {
    title: 'Identity-control directions',
    families: [
      ['gender', 'Gender', '#754363'],
      ['country', 'Country', '#596166']
    ]
  }
};

const splitCsvLine = line => {const values=[];let value='',quoted=false;for(let i=0;i<line.length;i+=1){const char=line[i];if(char==='"'){if(quoted&&line[i+1]==='"'){value+='"';i+=1;}else quoted=!quoted;}else if(char===','&&!quoted){values.push(value);value='';}else value+=char;}values.push(value);return values;};
const parseCsv = text => {
  const [head, ...lines] = text.trim().split(/\r?\n/);
  const columns = splitCsvLine(head);
  return lines.map(line => {const fields=splitCsvLine(line);return Object.fromEntries(columns.map((key, i) => [key, fields[i]]));});
};

const n = value => Number(value);
const fmt = value => n(value).toFixed(3);

function drawDiscovery(rows, modeName) {
  const mode = modes[modeName], svg = document.getElementById('discoveryChart');
  document.getElementById('discoveryFigureTitle').textContent = mode.title;
  const W = 1080, H = 440, left = 68, right = 26, top = 30, bottom = 58;
  const width = W - left - right, height = H - top - bottom;
  const x = (stream, layer) => left + ((stream === 'vision' ? n(layer) : 34 + n(layer)) / 81) * width;
  const y = value => top + (1 - (n(value) - .5) / .5) * height;
  const layers = [0.5, 0.6, 0.7, 0.8, 0.9, 1];
  const visionEdge = left + (34 / 81) * width;
  let content = `<rect x="${left}" y="${top}" width="${visionEdge-left}" height="${height}" fill="#f3f4f4"/><text x="${left+8}" y="${top+17}" class="axis">VISION STREAM · FIXED IMAGE</text><text x="${visionEdge+12}" y="${top+17}" class="axis">LANGUAGE STREAM · PERSONA INTEGRATION</text><line x1="${visionEdge}" y1="${top}" x2="${visionEdge}" y2="${H-bottom}" stroke="#8c9295" stroke-dasharray="4 4"/>`;
  layers.forEach(value => {
    const py = y(value);
    content += `<line class="grid" x1="${left}" y1="${py}" x2="${W-right}" y2="${py}"/><text class="axis" x="${left-11}" y="${py+4}" text-anchor="end">${value.toFixed(1)}</text>`;
  });
  content += `<text class="axis" x="${left}" y="${H-17}">V0</text><text class="axis" x="${visionEdge-3}" y="${H-17}" text-anchor="end">V33</text><text class="axis" x="${visionEdge+3}" y="${H-17}">L0</text><text class="axis" x="${W-right}" y="${H-17}" text-anchor="end">L47</text><text class="axis" x="${left}" y="${top-11}">PROJECTION AUROC</text>`;
  const readouts = [];
  mode.families.forEach(([family, label, color]) => {
    const group = rows.filter(row => row.family === family).sort((a, b) => (a.stream === b.stream ? n(a.layer_index) - n(b.layer_index) : a.stream === 'vision' ? -1 : 1));
    const points = group.map(row => [x(row.stream, row.layer_index), y(row.projection_auc_mean)]);
    const high = group.map(row => [x(row.stream, row.layer_index), y(row.projection_auc_max)]);
    const low = [...group].reverse().map(row => [x(row.stream, row.layer_index), y(row.projection_auc_min)]);
    content += `<path d="M${high.concat(low).map(p => p.join(',')).join('L')}Z" fill="${color}" opacity=".11"/><path d="M${points.map(p => p.join(',')).join('L')}" fill="none" stroke="${color}" stroke-width="3"/>`;
    const vision = group.filter(row => row.stream === 'vision');
    const language = group.filter(row => row.stream === 'language');
    const peak = language.reduce((best, row) => n(row.projection_auc_mean) > n(best.projection_auc_mean) ? row : best, language[0]);
    readouts.push(`<article><h3>${label}</h3><p>Vision peak <b>${fmt(Math.max(...vision.map(row => row.projection_auc_mean)))}</b><br>Language peak <b>${fmt(peak.projection_auc_mean)}</b> · L${peak.layer_index}</p></article>`);
  });
  svg.innerHTML = content;
  document.getElementById('discoveryLegend').innerHTML = mode.families.map(([, label, color]) => `<span><i style="background:${color}"></i>${label}</span>`).join('');
  document.getElementById('discoveryReadout').innerHTML = readouts.join('');
}

fetch(discoveryCsv).then(response => {
  if (!response.ok) throw new Error('The released separability export could not be loaded.');
  return response.text();
}).then(text => {
  const rows = parseCsv(text);
  let mode = 'states';
  const render = () => drawDiscovery(rows, mode);
  render();
  document.querySelectorAll('[data-discovery-mode]').forEach(button => button.addEventListener('click', () => {
    mode = button.dataset.discoveryMode;
    document.querySelectorAll('[data-discovery-mode]').forEach(item => item.classList.toggle('active', item === button));
    render();
  }));
}).catch(error => {
  document.getElementById('discoveryChart').outerHTML = `<p class="figure-note">${error.message}</p>`;
});

const geometryUrls = {
  vectors: 'data/geometry/vector_field_3d.json?v=20261008-geometry3',
  composition: 'data/geometry/persona_composition_paths.json?v=20261008-geometry3'
};
const vectorColours = ['#b24a48','#32745e','#754363','#243a91','#4f78b5','#bb7a1d','#6d549d','#c05252','#d67322','#bd9d32','#579866','#7063a8','#267b83','#9c6b5c','#68717b'];
let vectorView = {yaw:-.72, pitch:.36};
let compositionView = {yaw:-.68, pitch:.38};
let activeComponents = ['gender','emotion','country'];

function rotate3(point, yaw, pitch) {
  const [x,y,z] = point, cy=Math.cos(yaw), sy=Math.sin(yaw), cp=Math.cos(pitch), sp=Math.sin(pitch);
  const rx=cy*x-sy*y, ry=sy*x+cy*y;
  return [rx,cp*ry-sp*z,sp*ry+cp*z];
}
function projectPoints3(points, W, H, yaw, pitch, scale) {
  return points.map(point => { const [x,y,z]=rotate3(point,yaw,pitch); return [W/2+x*scale,H/2-y*scale,z]; });
}
function fitProjectedPoints(points, W, H, yaw, pitch, padX=82, padY=58) {
  const rotated=points.map(point=>rotate3(point,yaw,pitch));
  const xs=rotated.map(point=>point[0]), ys=rotated.map(point=>point[1]);
  const minX=Math.min(...xs), maxX=Math.max(...xs), minY=Math.min(...ys), maxY=Math.max(...ys);
  const spanX=Math.max(maxX-minX,.35), spanY=Math.max(maxY-minY,.35);
  const scale=Math.min((W-padX*2)/spanX,(H-padY*2)/spanY);
  const centreX=(minX+maxX)/2, centreY=(minY+maxY)/2;
  return rotated.map(([x,y,z])=>[W/2+(x-centreX)*scale,H/2-(y-centreY)*scale,z]);
}
function shortVectorLabel(direction) {
  const map = {
    workload_overwhelming_vs_minimal:'Workload / stress', emotion_excited_vs_angry:'Excitement − anger',
    gender_female_vs_male:'Gender', country_germany:'Germany', country_nigeria:'Nigeria',
    interest_blank_high_vs_low:'Interest · blank', interest_global_high_vs_low:'Interest · global'
  };
  return map[direction.id] || direction.label.replace('Emotion: ','');
}
function drawVectorField(data) {
  const svg=document.getElementById('vectorFieldChart'), W=1080,H=440;
  const points=fitProjectedPoints([[0,0,0],...data.directions.map(d=>d.display_endpoint),[.7,0,0],[0,.7,0],[0,0,.7]],W,H,vectorView.yaw,vectorView.pitch);
  const origin=points[0], directions=points.slice(1,1+data.directions.length), axes=points.slice(1+data.directions.length);
  let content='<defs>'+vectorColours.map((color,i)=>`<marker id="vector-arrow-${i}" markerUnits="userSpaceOnUse" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto"><path d="M0,0L9,4.5L0,9Z" fill="${color}"/></marker>`).join('')+'</defs>';
  axes.forEach((point,index)=>{ content+=`<path d="M${origin[0]},${origin[1]}L${point[0]},${point[1]}" stroke="#9aa1a1" stroke-width="1.2" stroke-dasharray="4 4"/><text class="axis" x="${point[0]+5}" y="${point[1]-5}">PC${index+1}</text>`; });
  data.directions.map((direction,index)=>({direction,index,point:directions[index]})).sort((a,b)=>a.point[2]-b.point[2]).forEach(({direction,index,point})=>{const color=vectorColours[index];const label=shortVectorLabel(direction), anchor=point[0]>origin[0]?'start':'end',dx=anchor==='start'?9:-9;content+=`<path d="M${origin[0]},${origin[1]}L${point[0]},${point[1]}" stroke="${color}" stroke-width="3" stroke-linecap="round" marker-end="url(#vector-arrow-${index})"/><circle cx="${point[0]}" cy="${point[1]}" r="4.5" fill="${color}"/><text class="vector-label" x="${point[0]+dx}" y="${point[1]-7}" text-anchor="${anchor}">${label}</text>`;});
  content+=`<circle cx="${origin[0]}" cy="${origin[1]}" r="6.5" fill="#11161a"/><text class="vector-origin" x="${origin[0]+10}" y="${origin[1]+16}">neutral reference</text>`;
  svg.innerHTML=content;
  document.getElementById('vectorLegend').innerHTML=data.directions.map((direction,index)=>`<span><i style="background:${vectorColours[index]}"></i>${direction.label}</span>`).join('');
}

function setCompositionOptions(data) {
  const emotions=[...new Set(data.conditions.map(condition=>condition.labels.emotion))], select=document.getElementById('personaEmotion');
  select.replaceChildren(...emotions.map(emotion=>Object.assign(document.createElement('option'),{value:emotion,textContent:emotion[0].toUpperCase()+emotion.slice(1)})));
  select.value='anger';
}
function activeCondition(data) {
  return data.conditions.find(condition=>condition.labels.gender===document.getElementById('personaGender').value && condition.labels.emotion===document.getElementById('personaEmotion').value && condition.labels.country===document.getElementById('personaCountry').value);
}
function appliedComponentColour(component, labels) {
  if(component==='gender') return '#754363';
  if(component==='country') return labels.country==='Germany' ? '#243a91' : '#4f78b5';
  return ({anger:'#c05252',amusement:'#d67322',awe:'#bd9d32',contentment:'#579866',disgust:'#7063a8',excitement:'#267b83',fear:'#9c6b5c',sad:'#68717b'})[labels.emotion] || '#32745e';
}
function drawComposition(data) {
  const condition=activeCondition(data), key=activeComponents.join('>'), prediction=key ? condition.predictions_by_order[key] : null, sequence=prediction ? prediction.stages : [];
  const stages=[{display:condition.grand_mean_display,label:'grand mean'},...sequence.map((stage,index)=>({display:stage.display,label:stage.included.at(-1)}))];
  const all=[...stages.map(stage=>stage.display),condition.observed_display], W=1080,H=400;
  /* Keep one shared 3D display scale across selections, then rotate the actual exported coordinates. */
  const referencePoints=data.conditions.flatMap(item=>[item.grand_mean_display,item.observed_display]);
  const scene=[...referencePoints,...all,[.7,0,0],[0,.7,0],[0,0,.7]], projected=fitProjectedPoints(scene,W,H,compositionView.yaw,compositionView.pitch,92,60);
  const base=referencePoints.length, displayStages=projected.slice(base,base+stages.length), observed=projected[base+stages.length], axes=projected.slice(base+all.length);
  const colours=sequence.map(stage=>appliedComponentColour(stage.included.at(-1),condition.labels));
  let content='<defs>'+colours.map((colour,index)=>`<marker id="composition-arrow-${index}" markerUnits="userSpaceOnUse" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto"><path d="M0,0L10,5L0,10Z" fill="${colour}"/></marker>`).join('')+'</defs>';
  const origin=displayStages[0];
  axes.forEach((point,index)=>{content+=`<path d="M${origin[0]},${origin[1]}L${point[0]},${point[1]}" fill="none" stroke="#9aa1a1" stroke-width="1.15" stroke-dasharray="4 4"/><text class="axis" x="${point[0]+5}" y="${point[1]-5}">PC${index+1}</text>`;});
  sequence.forEach((stage,index)=>{const start=displayStages[index], end=displayStages[index+1], colour=colours[index];content+=`<path d="M${start[0]},${start[1]}L${end[0]},${end[1]}" fill="none" stroke="${colour}" stroke-width="4" stroke-linecap="round" marker-end="url(#composition-arrow-${index})"/>`;});
  displayStages.forEach((point,index)=>{const stage=stages[index], isStart=index===0, colour=isStart?'#243a91':colours[index-1];content+=`<circle cx="${point[0]}" cy="${point[1]}" r="${isStart?7:6}" fill="${isStart?'#243a91':'#fff'}" stroke="${colour}" stroke-width="3"/><text class="composition-label" x="${point[0]+10}" y="${point[1]-9}" fill="${colour}">${isStart?'start':`${index}. + ${stage.label}`}</text>`;});
  content+=`<circle cx="${observed[0]}" cy="${observed[1]}" r="8" fill="#11161a"/><circle cx="${observed[0]}" cy="${observed[1]}" r="13" fill="none" stroke="#11161a" stroke-width="1.4"/><text class="composition-label" x="${observed[0]+12}" y="${observed[1]+18}">observed persona</text>`;
  document.getElementById('compositionChart').innerHTML=content;
  const final=prediction;
  document.getElementById('compositionCaption').textContent=`${condition.labels.gender} · ${condition.labels.emotion} · ${condition.labels.country} · ${activeComponents.length?activeComponents.join(' → '):'grand mean only'}`;
  document.getElementById('componentOrder').textContent=activeComponents.length ? `Addition order: ${activeComponents.map((component,index)=>`${index+1}. ${component}`).join(' → ')}` : 'No components selected';
  document.querySelectorAll('[data-component]').forEach(button=>button.classList.toggle('active',activeComponents.includes(button.dataset.component)));
  document.getElementById('compositionReadout').innerHTML=final ? `<article><b>${final.final_full_space_cosine_to_observed.toFixed(3)}</b><span>cosine to observed persona</span></article><article><b>${final.final_full_space_distance_to_observed.toFixed(2)}</b><span>full-space residual distance</span></article><article><b>${final.total_full_space_journey_from_start.toFixed(2)}</b><span>journey from grand mean</span></article>` : `<article><b>${condition.observed_full_space_distance_from_start.toFixed(2)}</b><span>observed distance from grand mean</span></article>`;
}
function initialiseGeometry(vectors, composition) {
  drawVectorField(vectors); setCompositionOptions(composition); drawComposition(composition);
  const svg=document.getElementById('vectorFieldChart'); let drag;
  svg.addEventListener('pointerdown',event=>{drag={x:event.clientX,y:event.clientY,yaw:vectorView.yaw,pitch:vectorView.pitch};svg.setPointerCapture(event.pointerId);svg.classList.add('rotating');});
  svg.addEventListener('pointermove',event=>{if(!drag)return;vectorView.yaw=drag.yaw+(event.clientX-drag.x)*.011;vectorView.pitch=Math.max(-1.2,Math.min(1.2,drag.pitch+(event.clientY-drag.y)*.008));drawVectorField(vectors);});
  svg.addEventListener('pointerup',()=>{drag=null;svg.classList.remove('rotating');});
  document.getElementById('vectorReset').addEventListener('click',()=>{vectorView={yaw:-.72,pitch:.36};drawVectorField(vectors);});
  const compositionSvg=document.getElementById('compositionChart'); let compositionDrag;
  compositionSvg.addEventListener('pointerdown',event=>{compositionDrag={x:event.clientX,y:event.clientY,yaw:compositionView.yaw,pitch:compositionView.pitch};compositionSvg.setPointerCapture(event.pointerId);compositionSvg.classList.add('rotating');});
  compositionSvg.addEventListener('pointermove',event=>{if(!compositionDrag)return;compositionView.yaw=compositionDrag.yaw+(event.clientX-compositionDrag.x)*.011;compositionView.pitch=Math.max(-1.2,Math.min(1.2,compositionDrag.pitch+(event.clientY-compositionDrag.y)*.008));drawComposition(composition);});
  compositionSvg.addEventListener('pointerup',()=>{compositionDrag=null;compositionSvg.classList.remove('rotating');});
  compositionSvg.addEventListener('pointercancel',()=>{compositionDrag=null;compositionSvg.classList.remove('rotating');});
  document.getElementById('compositionReset').addEventListener('click',()=>{compositionView={yaw:-.68,pitch:.38};drawComposition(composition);});
  ['personaGender','personaEmotion','personaCountry'].forEach(id=>document.getElementById(id).addEventListener('change',()=>drawComposition(composition)));
  document.querySelectorAll('[data-component]').forEach(button=>button.addEventListener('click',()=>{const component=button.dataset.component;activeComponents=activeComponents.includes(component)?activeComponents.filter(item=>item!==component):[...activeComponents,component];drawComposition(composition);}));
}
const geometryFetch = url => fetch(url).then(response=>{if(!response.ok)throw new Error('The released geometry export could not be loaded.');return response.json();});
Promise.all([geometryFetch(geometryUrls.vectors),geometryFetch(geometryUrls.composition)]).then(([vectors,composition])=>initialiseGeometry(vectors,composition)).catch(error=>{const message=error?.message||'Unknown loading error.';document.getElementById('vectorFieldChart').outerHTML=`<p class="figure-note">Geometry view unavailable: ${message}</p>`;document.getElementById('compositionChart').outerHTML=`<p class="figure-note">Composition view unavailable: ${message}</p>`;});

const causalCsv='data/causal/dose_response.csv?v=20261008-causal1';
const logitLensJson='data/causal/logit_lens_tokens.json?v=20261008-gallery1';
const uapGalleryJson='data/attack/uap_gallery.json?v=20261012-gallery1';
const parseNumber=value=>Number(value);
const titleCase=value=>value.split('_').map(word=>word[0].toUpperCase()+word.slice(1)).join(' ');
const option=(value,label)=>Object.assign(document.createElement('option'),{value,textContent:label});
const lexicalLabels=[['Not Interesting','n_not_interesting'],['Slightly Interesting','n_slightly_interesting'],['Moderately Interesting','n_moderately_interesting'],['Very Interesting','n_very_interesting'],['Extremely Interesting','n_extremely_interesting']];
let doseRows=[], logitLensSeries=[], uapGallery;

function renderLexiconCard(title,row,steered=false) {
  const nImages=parseNumber(row.n_images);
  return `<article class="lexicon-card ${steered?'steered':''}"><h3>${title}</h3>${lexicalLabels.map(([label,key])=>{const share=parseNumber(row[key])/nImages*100;return `<div class="lexicon-row"><span>${label}</span><span class="lexicon-track"><i style="width:${share}%"></i></span><b>${share.toFixed(0)}%</b></div>`;}).join('')}</article>`;
}
function renderCausal() {
  const [direction,layer]=document.getElementById('causalDirection').value.split('|');
  const rows=doseRows.filter(row=>row.direction===direction&&row.layer===layer).sort((a,b)=>parseNumber(a.alpha)-parseNumber(b.alpha));
  const alphaIndex=parseNumber(document.getElementById('causalAlpha').value), steered=rows[alphaIndex], reference=rows.find(row=>parseNumber(row.alpha)===0);
  if(!steered||!reference)return;
  document.getElementById('causalAlphaValue').textContent=`α = ${parseNumber(steered.alpha)>0?'+':''}${steered.alpha}`;
  document.getElementById('lexiconCompare').innerHTML=renderLexiconCard('Reference · α = 0',reference)+renderLexiconCard(`After steering · α = ${parseNumber(steered.alpha)>0?'+':''}${steered.alpha}`,steered,true);
  const signed=parseNumber(steered.mean_paired_delta_vs_alpha0), totalShift=Math.abs(signed);
  document.getElementById('causalReadout').innerHTML=`<article><b>${signed>=0?'+':''}${signed.toFixed(2)}</b><span>mean rating shift vs reference</span></article><article><b>${parseNumber(steered.mean_score).toFixed(2)}</b><span>mean rating after intervention</span></article><article><b>${steered.n_images}</b><span>matched evaluation inputs</span></article>`;
  renderLogitLens(direction,layer,parseNumber(steered.alpha));
}
function renderLogitLens(direction,layer,alpha) {
  const series=logitLensSeries.find(item=>item.direction===direction&&item.layer===layer), target=document.getElementById('logitLensCompare');
  if(!series){target.innerHTML='<p class="figure-note">Vocabulary export unavailable for this direction.</p>';return;}
  const factor=Math.abs(alpha)||1, reverse=alpha<0;
  const list=(items,kind)=>items.filter(item=>!item.incomplete_utf8).slice(0,8).map(item=>`<li><b>${item.display}</b><span>${kind}${(Math.abs(item.delta_logit_per_unit)*factor).toFixed(2)}</span></li>`).join('');
  const raised=reverse?series.pushed_down:series.pushed_up, lowered=reverse?series.pushed_up:series.pushed_down;
  const qualifier=alpha===0?'per +1 direction unit':'at selected α, linear logit-lens scale';
  target.innerHTML=`<div class="logit-columns"><section><h3>pushed up</h3><ol>${list(raised,'+')}</ol></section><section><h3>pushed down</h3><ol>${list(lowered,'−')}</ol></section></div><small>${qualifier}</small>`;
}
function initialiseCausal(rows,lens) {
  doseRows=rows;
  logitLensSeries=lens.series;
  const select=document.getElementById('causalDirection');
  const directions=[...new Map(rows.filter(row=>row.direction!=='workload'||row.layer==='language_29').map(row=>[`${row.direction}|${row.layer}`,row])).values()];
  select.replaceChildren(...directions.map(row=>option(`${row.direction}|${row.layer}`,`${row.direction_label} · ${row.layer.replace('language_','L')}`)));
  select.value='interest|language_29';
  select.addEventListener('change',renderCausal);
  document.getElementById('causalAlpha').addEventListener('input',renderCausal);
  renderCausal();
}
function renderUapGallery() {
  const target=uapGallery.targets.find(item=>item.target===document.getElementById('uapGalleryTarget').value), stepIndex=parseNumber(document.getElementById('uapGalleryEpsilon').value), epsilon=[0,...uapGallery.epsilons][stepIndex];
  if(!target)return;
  const current=stepIndex===0?null:epsilon;
  document.getElementById('uapGalleryEpsilonValue').textContent=current===null?'clean reference':`ε = ${current.toFixed(2)} · ${(current/2*100).toFixed(0)}% pixel range`;
  document.getElementById('uapGalleryCaption').textContent=`${target.target_label} · ${target.layer} · ${target.n_valid_images} held-out images`;
  const selected=target.selected_shift_at_ranking_epsilon, all=target.all_images_shift_at_ranking_epsilon;
  document.getElementById('uapGallerySummary').innerHTML=`<article><span>Clean reference</span><b>${target.n_valid_images} images</b><p>Same images, before the fixed perturbation.</p></article><div class="uap-gallery-bridge"><span>one fixed</span><b>δ</b><span>applied to each image</span></div><article class="altered"><span>After perturbation</span><b>${current===null?'ε = 0':`ε = ${current.toFixed(2)}`}</b><p>${target.target_direction||'Targeted residual-stream direction.'}</p></article><div class="uap-selection-stat"><b>${selected.mean_abs_delta.toFixed(2)}</b><span>selected mean |Δ rating|</span><b>${all.mean_abs_delta.toFixed(2)}</b><span>whole-sample mean |Δ|</span></div>`;
  document.getElementById('uapGalleryGrid').innerHTML=target.cards.map(card=>{const step=current===null?card.clean:card.steps.find(item=>item.epsilon===current), delta=current===null?0:step.delta_from_clean, image=current===null?card.clean.image:step.image, text=step.text_status==='available'?step.text:'Perturbed evaluation text pending; released rating shown.';return `<article class="uap-image-card"><img src="${image}" alt="Selected held-out image ${card.sample_id} at ${current===null?'clean reference':`epsilon ${current}`}."><div class="uap-card-id">${card.sample_id} · ${card.selected_as}</div><p class="uap-card-rating"><span>${card.clean.label} · ${card.clean.score}</span><b>→</b><span class="after">${step.label} · ${step.score} ${delta?`(${delta>0?'+':''}${delta})`:''}</span></p><p class="uap-card-text"><b>Clean:</b> ${card.clean.text}</p><p class="uap-card-text pending"><b>After δ:</b> ${text}</p></article>`;}).join('');
  document.getElementById('uapGalleryNote').textContent=`Selection note: four largest ${target.dominant_direction}s and the largest shift in the other direction at ε = 1.00. These are deliberately extreme examples, not representative inputs.`;
}
function initialiseUapGallery(data) {
  uapGallery=data;
  const select=document.getElementById('uapGalleryTarget');
  select.replaceChildren(...data.targets.map(item=>option(item.target,item.target_label)));
  select.value='interest';
  select.addEventListener('change',renderUapGallery);
  document.getElementById('uapGalleryEpsilon').addEventListener('input',renderUapGallery);
  renderUapGallery();
}
Promise.all([fetch(causalCsv).then(response=>response.ok?response.text():Promise.reject(new Error('Causal export unavailable.'))),fetch(logitLensJson).then(response=>response.ok?response.json():Promise.reject(new Error('Logit-lens export unavailable.'))),fetch(uapGalleryJson).then(response=>response.ok?response.json():Promise.reject(new Error('UAP gallery export unavailable.')))]).then(([causalText,lens,gallery])=>{initialiseCausal(parseCsv(causalText),lens);initialiseUapGallery(gallery);}).catch(error=>{document.getElementById('lexiconCompare').innerHTML=`<p class="figure-note">${error.message}</p>`;document.getElementById('logitLensCompare').innerHTML=`<p class="figure-note">${error.message}</p>`;document.getElementById('uapGalleryGrid').innerHTML=`<p class="figure-note">${error.message}</p>`;});

const transferCsv='data/attack/generalisation_summary.csv?v=20261012-transfer2';
const transferGalleryJson='data/attack/transfer_gallery.json?v=20261012-transfer2';
const transferEpsilons=[.1,.5,1,2];
let transferRows=[],transferGallery,activeTransfer={task:'shopping_relevance',attack:'interest',sampleId:null};
const signed=value=>`${value>0?'+':''}${value.toFixed(2)}`;
const countsFrom=value=>{try{return JSON.parse(value);}catch{return {};}};
const taskScale=task=>Object.entries(task.score_meanings).map(([score,meaning])=>`<span><b>${score}</b> ${meaning}</span>`).join('');
function transferDistribution(title,counts,row,task,steered=false,referenceCounts=null){
  const total=parseNumber(row.n);
  return `<article class="lexicon-card${steered?' steered':''}${referenceCounts?' with-reference':''}"><h3>${title}${referenceCounts?'<small><i></i> dotted = reference</small>':''}</h3>${Object.entries(task.score_meanings).map(([label,meaning])=>{const share=total?parseNumber(counts[label]||0)/total*100:0,referenceShare=referenceCounts&&total?parseNumber(referenceCounts[label]||0)/total*100:0,markerOnBar=referenceCounts&&share>0&&referenceShare<=share?`<i class="transfer-reference-marker transfer-reference-on-bar" style="left:${referenceShare/share*100}%"></i>`:'';return `<div class="lexicon-row"><span>${meaning}</span><span class="lexicon-track"><i class="transfer-bar" style="width:${share}%">${markerOnBar}</i>${referenceCounts&&!markerOnBar?`<i class="transfer-reference-marker" style="left:${referenceShare}%"></i>`:''}</span><b>${share.toFixed(0)}%</b></div>`;}).join('')}</article>`;
}
function transferDetailDistribution(title,counts,row,task){
  const total=parseNumber(row.n);
  return `<section><h3>${title}</h3>${Object.entries(task.score_meanings).map(([label,meaning])=>{const share=total?parseNumber(counts[label]||0)/total*100:0;return `<div class="transfer-label-row"><span>${label} · ${meaning}</span><i style="--share:${share}%"></i><b>${share.toFixed(0)}%</b></div>`;}).join('')}</section>`;
}
function selectedTransfer(){
  const task=transferGallery.tasks.find(item=>item.task===activeTransfer.task)||transferGallery.tasks[0];
  const target=task.targets.find(item=>item.target===activeTransfer.attack)||task.targets[0];
  const card=target.cards.find(item=>item.sample_id===activeTransfer.sampleId)||target.cards[0];
  activeTransfer={task:task.task,attack:target.target,sampleId:card.sample_id};
  return {task,target,card};
}
function transferExampleButton(task,target,card,epsilon){
  const step=card.steps.find(item=>item.epsilon===epsilon),active=task.task===activeTransfer.task&&target.target===activeTransfer.attack&&card.sample_id===activeTransfer.sampleId;
  return `<button type="button" class="transfer-example-button${active?' active':''}" data-transfer-task="${task.task}" data-transfer-attack="${target.target}" data-transfer-sample="${card.sample_id}"><img src="${step.image}" alt="${task.task_label} example ${card.sample_id} after epsilon ${epsilon}."><span>${card.sample_id.replace(/^shopping_/,'')}</span><b>${card.clean.label} → ${step.label}</b></button>`;
}
function transferUnavailableButton(task,target,card,epsilon){
  const step=card.steps.find(item=>item.epsilon===epsilon),active=task.task===activeTransfer.task&&target.target===activeTransfer.attack&&card.sample_id===activeTransfer.sampleId,identifier=card.item.image_id?.split('/').pop()||card.sample_id;
  return `<button type="button" class="transfer-unavailable-card transfer-unavailable-example${active?' active':''}" data-transfer-task="${task.task}" data-transfer-attack="${target.target}" data-transfer-sample="${card.sample_id}"><span>${identifier}</span><p>${card.clean.text}</p><b>${card.clean.label} → ${step.label}</b></button>`;
}
function transferExamplesForTask(task,target,epsilon){
  const published=target.cards.every(card=>card.image_policy?.status==='published'),examples=published?target.cards.map(card=>transferExampleButton(task,target,card,epsilon)).join(''):target.cards.map(card=>transferUnavailableButton(task,target,card,epsilon)).join('');
  return `<section class="transfer-task transfer-task-row"><header><div><b>${task.task_label}</b><span>${task.dataset}</span></div><div class="transfer-task-scale">${taskScale(task)}</div></header><div class="transfer-task-content"><div class="transfer-example-cluster"><div class="transfer-example-heading"><b>${target.target_label}</b><span>5 selected inputs</span></div><div class="transfer-selected-strip${published?'':' unavailable'}">${examples}</div>${published?'':'<p class="transfer-source-note">Source images are withheld under MEDIC’s terms; identifiers and model descriptions are shown instead.</p>'}</div>${transferDistributionPanel(task,target,epsilon)}</div></section>`;
}
function renderTransferDetail(task,target,card,epsilon){
  const step=card.steps.find(item=>item.epsilon===epsilon),row=transferRows.find(item=>item.task===task.task&&item.attack===target.target&&parseNumber(item.epsilon)===epsilon),clean=countsFrom(row.clean_label_counts),perturbed=countsFrom(row.perturbed_label_counts),query=card.item.query?`<p class="transfer-query"><b>Shopping query</b> ${card.item.query}<br><b>Product</b> ${card.item.title}</p>`:'',isPublished=card.image_policy?.status==='published'&&card.clean?.image&&step?.image,contentNote=card.image_policy?.content_warning?`<p class="transfer-content-note"><b>Content note</b> ${card.image_policy.content_warning}</p>`:'',credit=card.provenance?`<p class="transfer-image-credit">Image: <a href="${card.provenance.source_url}" target="_blank" rel="noreferrer">${card.provenance.title}</a> — ${card.provenance.author} · <a href="${card.provenance.licence_url}" target="_blank" rel="noreferrer">${card.provenance.licence}</a></p>`:'',visual=isPublished?`<div class="transfer-visual-wrap"><div class="transfer-image-pair"><figure><img src="${card.clean.image}" alt="Clean selected input ${card.sample_id}."><figcaption>Clean input</figcaption></figure><figure><img src="${step.image}" alt="Selected input ${card.sample_id} after epsilon ${epsilon}."><figcaption>After ε = ${epsilon.toFixed(2)}</figcaption></figure></div>${contentNote}${credit}</div>`:`<div class="transfer-image-unavailable"><b>Source image description</b><p>${card.clean.text}</p><span>${card.sample_id} · source image withheld under ${card.image_policy?.reason||task.image_policy.reason}</span></div>`;
  document.getElementById('transferDetail').innerHTML=`<div class="transfer-detail-header"><div><b>${task.task_label} · ${target.target_label}</b><span>${task.dataset} · selected ${card.sample_id}</span></div><span>ε = ${epsilon.toFixed(2)} · ${(epsilon/2*100).toFixed(0)}% pixel range</span></div><div class="transfer-detail-main">${visual}<div class="transfer-output"><div class="transfer-scale"><b>Task scale</b><div>${taskScale(task)}</div></div>${query}<section><h3>Clean judgement</h3><b>${card.clean.label} · ${card.clean.label_meaning}</b><p>${card.clean.text}</p></section><section class="after"><h3>After the same UAP</h3><b>${step.label} · ${step.label_meaning} <em>${step.delta_from_clean?`(${step.delta_from_clean>0?'+':''}${step.delta_from_clean})`:''}</em></b><p>${step.text}</p></section></div></div><div class="transfer-aggregate"><div class="transfer-score-bridge"><article><b>${parseNumber(row.clean_mean).toFixed(2)}</b><span>all ${row.n} inputs: clean mean</span></article><span>Δ ${signed(parseNumber(row.mean_signed_shift))}</span><article><b>${parseNumber(row.perturbed_mean).toFixed(2)}</b><span>all ${row.n} inputs: after UAP</span></article></div><div class="transfer-distribution-grid">${transferDetailDistribution('Clean reference',clean,row,task)}${transferDetailDistribution('After perturbation',perturbed,row,task)}</div></div>`;
}
function transferDistributionPanel(task,target,epsilon){
  const row=transferRows.find(item=>item.task===task.task&&item.attack===target.target&&parseNumber(item.epsilon)===epsilon),clean=countsFrom(row.clean_label_counts),perturbed=countsFrom(row.perturbed_label_counts);
  return `<section class="transfer-summary-card"><div class="transfer-distribution-grid">${transferDistribution(`After steering · ε = ${epsilon.toFixed(2)}`,perturbed,row,task,true,clean)}</div></section>`;
}
function renderTransfer(){
  const epsilon=transferEpsilons[parseNumber(document.getElementById('transferEpsilon').value)],matrix=document.getElementById('transferMatrix'),targetId=document.getElementById('transferTarget').value||'interest',selectedTarget=transferGallery.tasks[0].targets.find(item=>item.target===targetId)||transferGallery.tasks[0].targets[0];
  activeTransfer.attack=selectedTarget.target;
  document.getElementById('transferEpsilonValue').textContent=`ε = ${epsilon.toFixed(2)} · ${(epsilon/2*100).toFixed(0)}% pixel range`;
  document.getElementById('transferCaption').textContent=`${selectedTarget.target_label} UAP · ε = ${epsilon.toFixed(2)} · example cards and all-input distributions update together`;
  const {task,target,card}=selectedTransfer();
  matrix.innerHTML=transferGallery.tasks.map(item=>{const attack=item.targets.find(candidate=>candidate.target===selectedTarget.target)||item.targets[0];return transferExamplesForTask(item,attack,epsilon);}).join('');
  matrix.querySelectorAll('[data-transfer-task]').forEach(button=>button.addEventListener('click',()=>{activeTransfer={task:button.dataset.transferTask,attack:button.dataset.transferAttack,sampleId:button.dataset.transferSample};renderTransfer();const details=document.getElementById('transferDetailsTitle');details.focus({preventScroll:true});details.scrollIntoView({behavior:'smooth',block:'start'});}));
  renderTransferDetail(task,target,card,epsilon);
}
Promise.all([fetch(transferCsv).then(response=>response.ok?response.text():Promise.reject(new Error('Transfer summary unavailable.'))),fetch(transferGalleryJson).then(response=>response.ok?response.json():Promise.reject(new Error('Transfer gallery unavailable.')))]).then(([summary,gallery])=>{transferRows=parseCsv(summary);transferGallery=gallery;const targetSelect=document.getElementById('transferTarget');targetSelect.innerHTML=gallery.tasks[0].targets.map(target=>`<option value="${target.target}">${target.target_label}</option>`).join('');targetSelect.value=activeTransfer.attack;targetSelect.addEventListener('change',()=>{activeTransfer.sampleId=null;renderTransfer();});document.getElementById('transferEpsilon').addEventListener('input',renderTransfer);renderTransfer();}).catch(error=>{document.getElementById('transferMatrix').innerHTML=`<p class="transfer-empty">${error.message}</p>`;document.getElementById('transferDetail').innerHTML='';});
