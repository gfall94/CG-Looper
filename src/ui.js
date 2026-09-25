'use strict';
const $=id=>document.getElementById(id);
const fieldGroups={
 seriesFields:[['loops','Anzahl · ausgewählte Datei','Stückzahl der markierten Datei'],['pause','Pause zwischen Drucken / s','Nach Ausräumen und Endcode']],
 bendFields:[['bendBase','Biege-Basis Z / mm','Z-Position bei entlasteter Platte'],['bendDepth','Biegetiefe / mm','Zusätzlicher Z-Weg ab der Biege-Basis'],['bends','Biegezyklen','Ein Zyklus = hin und zurück'],['bendSpeed','Z-Geschwindigkeit / mm/s','Maximalwert aus dem Druckerprofil']],
 sweepFields:[['sweepZ','Ausräumhöhe Z / mm','Wird beim Laden vorgeschlagen; frei einstellbar'],['sweepSpeed','Ausräumgeschwindigkeit / mm/s','Geschwindigkeit der ersten Schiebefahrten']],
 patternFields:[['centerPasses','Mittlere Ausräumfahrten','Bei X125; 0 deaktiviert'],['fastSpeed','Schnelle Rechenfahrt / mm/s','Geschwindigkeit des zweiten Durchgangs'],['xPositions','X-Positionen / mm','Kommagetrennt, von rechts nach links'],['rearY','Hintere Kante Y / mm','Start der jeweiligen Schiebebewegung'],['frontY','Vordere Kante Y / mm','Ziel der Schiebebewegung'],['parkZ','Parkhöhe Z / mm','Nach dem Ausräumen']],
 coolFields:[['cooldownSeconds','Feste Kühlpause / s','60 s = 1 Minute, passend einstellen'],['fan','Kühllüfter / %','Bauteil-, Zusatz- und Gehäuselüfter']],
 temperatureFields:[['cooldownTemp','Zieltemperatur der Platte / °C','Oberhalb der Raumtemperatur wählen'],['cooldownRepeats','Temperaturbefehl wiederholen','Anzahl der Aufrufe; keine Zeitangabe'],['postTempSeconds','Zusatzpause nach Temperaturfreigabe / s','Einmal pro Ausräumvorgang; 0 deaktiviert']],
 purgeFields:[['purgeLength','Spülmenge / mm Filament','Länge des geförderten Filaments'],['purgeSpeed','Spülvorschub / mm/min','Filamentvorschub pro Minute (nicht mm/s)']],
 exportFields:[['maxOutputMB','Maximale Ausgabegröße / MB','250–4096 MB; große Exporte benötigen deutlich mehr Arbeitsspeicher']]
};
for(const [group,fields] of Object.entries(fieldGroups))for(const [key,title,hint] of fields){
 const label=document.createElement('label');label.className='field'+(key==='xPositions'?' wide':'');label.textContent=title;
 const input=document.createElement('input');input.id=key;input.type=key==='xPositions'?'text':'number';
 if(Looper.numberSpec[key]){const [min,max,int]=Looper.numberSpec[key];input.min=min;input.max=max;input.step=int?'1':'any';}
 label.append(input);const small=document.createElement('small');small.textContent=hint;label.append(small);$(group).append(label);
}
let loaded=null,result=null,archiveEntries=null,archivePath=null,sourceName='',busy=false;
const jobs=[];let selectedId=null,nextJobId=1,importing=false;
const selectedJob=()=>jobs.find(j=>j.id===selectedId);
const sequenceView=new SequenceView();
function duration(seconds){if(!Number.isFinite(seconds))return 'Unbekannt';const v=Math.round(seconds),h=Math.floor(v/3600),m=Math.floor(v%3600/60),s=v%60;return [h?`${h} h`:'',m?`${m} min`:'',s||(!h&&!m)?`${s} s`:''].filter(Boolean).join(' ');}
function showWaits(s){
 const w=Looper.waitTimes(s),label=s.cooldownMode==='temperature'?'Zusatzpause nach Temperaturfreigabe':'Feste Kühlpause';
 $('waitSummary').textContent=`${label}: ${w.clearCount} × ${duration(w.perClear)} = ${duration(w.coolingSeconds)}.\nZwischen den Drucken: ${w.betweenCount} × ${duration(s.pause)} = ${duration(w.betweenSeconds)}.\nPlanbare Wartezeit insgesamt: ${duration(w.fixedSeconds)}${w.temperaturePhases?` + ${w.temperaturePhases} temperaturabhängige Wartephasen (Dauer offen).`:'.'}\nGezählt werden nur die hier eingestellten Pausen; Wartezeiten im Original-Druckstart sind nicht separat aufgeschlüsselt.`;
}
function showTiming(t){
 $('singleTime').textContent=duration(t.singlePrintSeconds);$('printsTime').textContent=duration(t.printSeconds);
 $('fixedWaitTime').textContent=duration(t.waits.fixedSeconds);$('motionTime').textContent=Number.isFinite(t.motionSeconds)?'ca. '+duration(t.motionSeconds):'Unbekannt';
 $('totalTime').textContent=Number.isFinite(t.knownSeconds)?'ca. '+duration(t.knownSeconds):'Nicht vollständig berechenbar';
 $('totalTimeNote').textContent=t.waits.temperaturePhases?`Zuzüglich ${t.waits.temperaturePhases} temperaturabhängiger Wartephasen – deren Dauer ist offen.`:'Orientierungswert für die gesamte Druckserie.';
}
function clearTiming(){for(const id of ['singleTime','printsTime','fixedWaitTime','motionTime','totalTime'])$(id).textContent='—';$('totalTimeNote').textContent='Für die Zeitübersicht eine Datei laden.';sequenceView.setData(null,1);}
function getSettings(){const o={};for(const [key,value]of Object.entries(Looper.defaults)){const el=$(key);o[key]=typeof value==='boolean'?el.checked:typeof value==='number'?(el.value.trim()===''?NaN:Number(el.value)):el.value;}return o;}
function setSettings(s){for(const [key,value]of Object.entries(Looper.defaults)){const el=$(key);let v=s[key]??value;if(key==='cooldownMode'&&v==='reference')v='combined';if(typeof value==='boolean')el.checked=v;else el.value=v;}}
function status(message,error=false){$('status').hidden=!message;$('status').className='status'+(error?' error':'');$('status').textContent=message;}
function saveLocal(s){try{localStorage.setItem('cg-looper-v2',JSON.stringify(s));}catch{}}
function applySweepSuggestion(){if(loaded){$('sweepZ').value=loaded.sweepSuggestion;if(selectedJob())selectedJob().sweepZ=loaded.sweepSuggestion;}}
function refresh(){
 const s=getSettings();result=null;$('exportGcode').disabled=true;$('export3mf').disabled=true;
 const selected=selectedJob();if(selected){selected.count=s.loops;selected.sweepZ=s.sweepZ;}
 const total=jobs.reduce((n,j)=>n+j.count,0);
 for(const card of $('jobList').children){const j=jobs.find(j=>j.id===Number(card.dataset.id));const input=card.querySelector('.job-count');if(j&&document.activeElement!==input)input.value=j.count;}
 $('temperatureFields').hidden=s.cooldownMode==='time';
 $('cooldownRepeats').closest('label').hidden=s.cooldownMode!=='combined';
 $('cooldownSeconds').closest('label').hidden=s.cooldownMode==='temperature';
 $('cooldownSeconds').disabled=s.cooldownMode==='temperature';
 $('cooldownRepeats').disabled=s.cooldownMode!=='combined';
 $('cooldownTemp').disabled=s.cooldownMode==='time';
 $('postTempSeconds').closest('label').hidden=s.cooldownMode!=='temperature';
 $('postTempSeconds').disabled=s.cooldownMode!=='temperature';
 $('statLoops').textContent=(jobs.length?total:0)+'×';
 $('applySweepSuggestion').disabled=!loaded;
 $('sweepSuggestion').textContent=loaded?`Vorschlag: ${loaded.sweepSuggestion.toLocaleString('de-DE')} mm aus ${loaded.height.toLocaleString('de-DE')} mm Bauteilhöhe. ${s.sweepZ===loaded.sweepSuggestion?'Vorschlag aktiv.':'Eigener Wert aktiv.'}`:'Nach dem Laden wird ein Vorschlag aus der Bauteilhöhe eingetragen.';
 $('cooldownHint').textContent={
  time:'Das Bett wird ausgeschaltet. Nach Ablauf der eingestellten Zeit beginnt das Ausräumen – unabhängig von der Temperatur.',
  combined:'Der Drucker erhält die Zieltemperatur mehrfach und wartet anschließend die feste Kühlpause ab. Das tatsächliche Warteverhalten hängt von seiner Firmware ab; Wiederholungen garantieren keine erreichte Temperatur.',
  temperature:'Der Drucker wartet mit seinem Temperaturbefehl auf den Sollwert. Danach folgt die eingestellte Zusatzpause einmal pro Ausräumvorgang. Wichtig beim P1S: Firmware-Toleranzen und mögliche Zeitlimits können die Temperatur-Wartephase beenden; eine strikt eingehaltene Temperaturgrenze ist ohne Rückmeldung vom Drucker nicht garantiert.'
 }[s.cooldownMode]||'';
 $('bendSummary').textContent=`Biegebereich Z${s.bendBase} → Z${+(s.bendBase+s.bendDepth).toFixed(3)} · ${s.bendDepth} mm Hub`;
 try{showWaits(Looper.validate(loaded?{...loaded,bytes:0}:{maxZ:250,height:0,maxZSpeed:20,bytes:0},{...s,loops:jobs.length?total:s.loops}));}catch{$('waitSummary').textContent='Für die Wartezeitübersicht bitte gültige Einstellungen eingeben.';}
 $('queueOrder').replaceChildren();$('multiExportNote').hidden=jobs.length<2;
 if(!loaded){clearTiming();$('preview').textContent='Nach dem Laden erscheint hier die erzeugte Sequenz.';$('statHeight').textContent='—';$('statGrams').textContent='—';$('estimate').textContent='Lade eine Datei für Bauteilhöhe und Verbrauch.';$('outputSizeInfo').textContent=`Ausgabelimit: ${s.maxOutputMB.toLocaleString('de-DE')} MB.`;$('warnings').replaceChildren();return;}
 try{
  result=Looper.generateQueue(jobs,s,$('jobOrder').value);saveLocal(s);$('statHeight').textContent=Math.max(...jobs.map(j=>j.info.height)).toLocaleString('de-DE');$('statGrams').textContent=result.grams.toLocaleString('de-DE',{maximumFractionDigits:1});
  const activeIndex=jobs.indexOf(selected),active=result.details[activeIndex];
  const activeClears=result.plan.filter((i,step)=>i===activeIndex&&(step<result.plan.length-1||s.clearLast)).length;
  showTiming({...result.timing,singlePrintSeconds:loaded.printSeconds});sequenceView.setData(active.motion,activeClears);
  $('outputSizeInfo').textContent=`Geschätzte G-Code-Ausgabe: ${(result.estimatedOutputBytes/1024/1024).toLocaleString('de-DE',{maximumFractionDigits:1})} MB · Limit: ${s.maxOutputMB.toLocaleString('de-DE')} MB.`;
  for(const index of result.plan){const item=document.createElement('span');item.textContent=String.fromCharCode(65+index);item.title=jobs[index].name;$('queueOrder').append(item);}
  $('estimate').textContent=`Ausgewählt: ${selected.name} · ${loaded.layers} Schichten · Vorschau dieser Datei. Zeit und Material oben beziehen sich auf die gesamte Warteschlange. Slicer-Zeit inklusive Druckstart, Bewegungszeit ohne Beschleunigung; Änderungen an Spülen und ursprünglichem Parken sind nicht exakt eingerechnet.`;
  $('warnings').replaceChildren();const list=document.createElement('ul');for(const w of result.warnings){const li=document.createElement('li');li.textContent=w;list.append(li);}$('warnings').append(list);
  $('preview').textContent=active.preview;$('exportGcode').disabled=busy||importing;$('export3mf').disabled=busy||importing||jobs.length!==1||!archiveEntries;status(`${jobs.length} Datei(en), ${total} Drucke. Parameterprüfung bestanden; Druckserie bereit.`);
 }catch(e){clearTiming();status(e.message,true);$('outputSizeInfo').textContent=`Ausgabelimit: ${Number.isFinite(s.maxOutputMB)?s.maxOutputMB.toLocaleString('de-DE'):'—'} MB.`;$('preview').textContent='Bitte die angegebenen Parameter korrigieren.';$('warnings').replaceChildren();}
}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
function renderJobs(){
 $('jobList').replaceChildren();
 jobs.forEach((j,index)=>{
  const card=document.createElement('div');card.className='job-card'+(j.id===selectedId?' selected':'');card.dataset.id=j.id;
  const figure=document.createElement('figure'),img=document.createElement('img');img.src=j.thumb.url;img.alt='Vorschau: '+j.name;img.className='job-thumb';
  const caption=document.createElement('figcaption');caption.textContent=j.thumb.kind;img.addEventListener('error',()=>{img.hidden=true;caption.textContent='Vorschaubild nicht lesbar';});figure.append(img,caption);
  const content=document.createElement('div'),choose=document.createElement('button');choose.type='button';choose.className='job-select';choose.textContent=String.fromCharCode(65+index)+' · '+j.name;choose.setAttribute('aria-pressed',j.id===selectedId);choose.addEventListener('click',()=>selectJob(j.id));
  const details=document.createElement('div');details.className='note';details.textContent=`${duration(j.info.printSeconds)} je Druck · ${j.info.grams.toLocaleString('de-DE')} g · Z${j.info.height} mm`;
  const toolbar=document.createElement('div');toolbar.className='toolbar';const label=document.createElement('label');label.className='field';label.textContent='Anzahl';const count=document.createElement('input');count.type='number';count.min=1;count.max=100;count.step=1;count.value=j.count;count.className='job-count';count.setAttribute('aria-label','Anzahl für '+j.name);count.addEventListener('input',()=>{j.count=count.value===''?NaN:Number(count.value);if(j.id===selectedId)$('loops').value=count.value;refresh();});label.append(count);
  const remove=document.createElement('button');remove.type='button';remove.textContent='Entfernen';remove.addEventListener('click',()=>{if(j.thumb.blob)URL.revokeObjectURL(j.thumb.url);jobs.splice(jobs.indexOf(j),1);if(selectedId===j.id)selectJob(jobs[0]?.id??null);else{renderJobs();refresh();}});
  const up=document.createElement('button');up.type='button';up.textContent='↑';up.setAttribute('aria-label',j.name+' nach oben');up.disabled=index===0;up.addEventListener('click',()=>{[jobs[index-1],jobs[index]]=[jobs[index],jobs[index-1]];renderJobs();refresh();});
  toolbar.append(label,up,remove);content.append(choose,details,toolbar);card.append(figure,content);$('jobList').append(card);
 });
 $('clearJobs').disabled=jobs.length===0||importing;
}
function selectJob(id){
 selectedId=id;const j=selectedJob();loaded=j?.info??null;archiveEntries=j?.entries??null;archivePath=j?.path??null;sourceName=j?.name??'';
 $('plate').replaceChildren();$('plateField').hidden=!j||j.paths.length<2;
 if(j){$('loops').value=j.count;$('sweepZ').value=j.sweepZ;for(const name of j.paths){const option=document.createElement('option');option.value=name;option.textContent=name;$('plate').append(option);}$('plate').value=j.path;}
 $('fileInfo').textContent=j?`Ausgewählt: ${j.name}${j.path?' · '+j.path:''}. Ausräumhöhe gilt nur für diese Datei; übrige Einstellungen gelten für alle.`:'Dateien gemeinsam auswählen oder nacheinander hinzufügen.';
 renderJobs();refresh();
}
function choosePlate(){
 const j=selectedJob();if(!j)return;
 try{const path=$('plate').value,entry=j.entries.find(e=>e.name===path),info=Looper.analyze(new TextDecoder('utf-8',{fatal:true}).decode(entry.data));
  const thumb=jobThumbnail(info,j.entries,path);if(j.thumb.blob)URL.revokeObjectURL(j.thumb.url);
  Object.assign(j,{path,info,thumb,sweepZ:info.sweepSuggestion,hash:Archive.md5(entry.data)});selectJob(j.id);
 }catch(e){$('plate').value=j.path;status(e.message,true);}
}
async function loadFiles(files){
 if(importing||!files.length)return;importing=true;$('file').disabled=true;refresh();status('Dateien werden lokal eingelesen …');const errors=[];let firstAdded=null;
 try{for(const file of Array.from(files)){
  try{
   if(jobs.length>=20)throw Error('Maximal 20 Dateien pro Warteschlange.');
   if(file.size>100*1024*1024)throw Error('Maximale Eingabegröße je Datei: 100 MB.');
   const buffer=await file.arrayBuffer();let entries=null,path=null,paths=[],data;
   if(/\.3mf$/i.test(file.name)){
    entries=await Archive.read(buffer);paths=entries.filter(e=>/\.gcode$/i.test(e.name)).map(e=>e.name);if(!paths.length)throw Error('Das 3MF enthält keinen geslicten G-Code.');path=paths[0];data=entries.find(e=>e.name===path).data;
   }else if(/\.gcode$/i.test(file.name))data=new Uint8Array(buffer);else throw Error('Bitte .gcode oder .gcode.3mf verwenden.');
   const bytes=entries?entries.reduce((n,e)=>n+e.data.length,0):data.length;
   if(jobs.reduce((n,j)=>n+j.bytes,0)+bytes>250*1024*1024)throw Error('Geladene Dateien überschreiten zusammen 250 MB.');
   const info=Looper.analyze(new TextDecoder('utf-8',{fatal:true}).decode(data));const thumb=jobThumbnail(info,entries,path);
   const j={id:nextJobId++,name:file.name,entries,path,paths,info,thumb,hash:Archive.md5(data),bytes,count:jobs.length?1:Number($('loops').value)||1,sweepZ:info.sweepSuggestion};jobs.push(j);firstAdded??=j.id;
  }catch(e){errors.push(file.name+': '+e.message);}
 }}finally{importing=false;$('file').disabled=false;$('file').value='';selectJob(selectedId??firstAdded);if(errors.length)status('Nicht hinzugefügt:\n'+errors.join('\n')+'\nBereits geladene Dateien bleiben erhalten.',true);}
}
$('file').addEventListener('change',e=>loadFiles(e.target.files));$('plate').addEventListener('change',choosePlate);
for(const event of ['dragover','dragenter'])$('drop').addEventListener(event,e=>{e.preventDefault();$('drop').classList.add('drag');});
for(const event of ['dragleave','drop'])$('drop').addEventListener(event,e=>{e.preventDefault();$('drop').classList.remove('drag');});
$('drop').addEventListener('drop',e=>loadFiles(e.dataTransfer.files));
$('clearJobs').addEventListener('click',()=>{for(const j of jobs)if(j.thumb.blob)URL.revokeObjectURL(j.thumb.url);jobs.length=0;selectJob(null);});
$('jobOrder').addEventListener('change',()=>{try{localStorage.setItem('cg-looper-order',$('jobOrder').value);}catch{}refresh();});
$('settings').addEventListener('submit',e=>e.preventDefault());$('settings').addEventListener('input',refresh);
async function exportFile(kind){
 if(!result||busy||importing)return;if(kind==='3mf'&&(jobs.length!==1||!archiveEntries))return;
 busy=true;const snapshot=result,entries=archiveEntries,path=archivePath,name=jobs.length===1?sourceName:'Druckwarteschlange';refresh();status('Export wird erstellt …');
 try{
  await new Promise(resolve=>setTimeout(resolve,30));
  const stem=name.replace(/(?:\.gcode)?\.3mf$|\.gcode$/i,'')+`_${snapshot.settings.loops}x_CG-Looper`;
  const blob=kind==='3mf'?Archive.pack(entries,path,snapshot.parts.join('')):new Blob(snapshot.parts,{type:'text/plain;charset=utf-8'});
  download(blob,stem+(kind==='3mf'?'.gcode.3mf':'.gcode'));
  busy=false;refresh();status(`Export erstellt (${(blob.size/1024/1024).toFixed(1)} MB). Download im Browser gestartet.`);
 }catch(e){busy=false;refresh();status('Export fehlgeschlagen: '+e.message,true);}
}
$('exportGcode').addEventListener('click',()=>exportFile('gcode'));$('export3mf').addEventListener('click',()=>exportFile('3mf'));
$('savePreset').addEventListener('click',()=>{try{const s=getSettings();if(jobs.length)Looper.generateQueue(jobs,s,$('jobOrder').value);else Looper.validate({maxZ:250,height:0,maxZSpeed:20,bytes:0},s);download(new Blob([JSON.stringify({version:2,settings:s,order:$('jobOrder').value,queue:jobs.map(j=>({hash:j.hash,name:j.name,path:j.path,count:j.count,sweepZ:j.sweepZ}))},null,2)],{type:'application/json'}),'CG-Looper-Profil.json');}catch(e){status(e.message,true);}});
$('loadPreset').addEventListener('click',()=>$('presetFile').click());
$('presetFile').addEventListener('change',async e=>{
 try{
  const f=e.target.files[0];if(!f)return;if(f.size>65536)throw Error('Profildatei zu groß.');const p=JSON.parse(await f.text());if(![1,2].includes(p.version)||!p.settings)throw Error('Unbekanntes Profilformat.');
  const s=Looper.validate(loaded||{maxZ:250,height:0,maxZSpeed:20,bytes:0},p.settings);
  if(p.version===2&&p.queue?.length){
   if(!Array.isArray(p.queue)||p.queue.length!==jobs.length)throw Error('Bitte zuerst dieselben Druckdateien und Platten wie im Profil laden.');
   const available=[...jobs],ordered=p.queue.map(q=>{const index=available.findIndex(j=>j.hash===q.hash&&j.path===q.path);if(index<0)throw Error('Eine passende Druckdatei/Platte fehlt: '+q.name);const j=available.splice(index,1)[0];return {...j,count:q.count,sweepZ:q.sweepZ};});
   Looper.generateQueue(ordered,s,p.order);jobs.splice(0,jobs.length,...ordered);$('jobOrder').value=p.order;
  }else if(p.version===2){if(!['alternating','batch'].includes(p.order))throw Error('Ungültige Reihenfolge im Profil.');$('jobOrder').value=p.order;}
  setSettings(s);
  if(p.version===1&&selectedJob()){selectedJob().count=s.loops;selectedJob().sweepZ=s.sweepZ;}
  selectJob(selectedId);saveLocal(getSettings());
 }catch(err){status('Profil: '+err.message,true);}finally{e.target.value='';}
});
$('reset').addEventListener('click',()=>{setSettings(Looper.defaults);applySweepSuggestion();saveLocal(getSettings());refresh();});
$('applySweepSuggestion').addEventListener('click',()=>{applySweepSuggestion();refresh();});
setSettings(Looper.defaults);try{const stored=JSON.parse(localStorage.getItem('cg-looper-v2'));if(stored){Looper.validate({maxZ:250,height:0,maxZSpeed:20,bytes:0},stored);setSettings(stored);}}catch{}
try{const order=localStorage.getItem('cg-looper-order');if(['alternating','batch'].includes(order))$('jobOrder').value=order;}catch{}
refresh();
