'use strict';
// CG Looper: deliberately limited to the supported P1S end/start structure.
const Looper = (() => {
  const defaults = {loops:5, bendBase:185, bendDepth:35, bends:6, bendSpeed:20,
    sweepZ:10, sweepSpeed:50, fastSpeed:200, centerPasses:2, rake:true, fastRake:true,
    xPositions:'220,190,160,130,100,70,30', rearY:250, frontY:0,
    cooldownMode:'combined', cooldownSeconds:60, cooldownTemp:35, cooldownRepeats:60, postTempSeconds:0,
    fan:100, pause:2, clearLast:true, purge:true, purgeLength:50, purgeSpeed:200,
    parkZ:20.2};
  const numberSpec = {
    loops:[1,100,true],bendBase:[0,250],bendDepth:[0.1,100],bends:[1,30,true],bendSpeed:[0.1,20],
    sweepZ:[0.2,250],sweepSpeed:[1,200],fastSpeed:[1,200],centerPasses:[0,10,true],
    rearY:[0,256],frontY:[0,256],cooldownSeconds:[0,7200,true],cooldownTemp:[15,80],
    cooldownRepeats:[1,120,true],postTempSeconds:[0,7200,true],fan:[0,100,true],pause:[0,3600,true],purgeLength:[1,100],
    purgeSpeed:[30,600],parkZ:[0.2,250]
  };
  const END = ';===== date: 20230428 =====================';
  const PARK = /M400 ; wait all motion done\nM17 S\nM17 Z0\.4[^\n]*\n/;
  const n = x => Number(x.toFixed(4)).toString();
  function parseDuration(value) {
    if(typeof value!=='string'||!value.trim())return null;
    const units={d:86400,h:3600,m:60,s:1};let seconds=0,count=0;
    const rest=value.replace(/(\d+(?:\.\d+)?)\s*([dhms])/gi,(_,v,u)=>{seconds+=Number(v)*units[u.toLowerCase()];count++;return '';});
    return count&&!rest.trim()&&Number.isFinite(seconds)?seconds:null;
  }
  function waitTimes(s) {
    const clearCount=s.loops-(s.clearLast?0:1),betweenCount=s.loops-1;
    const perClear=s.cooldownMode==='temperature'?s.postTempSeconds:s.cooldownSeconds;
    const coolingSeconds=clearCount*perClear,betweenSeconds=betweenCount*s.pause;
    return {clearCount,betweenCount,perClear,coolingSeconds,betweenSeconds,fixedSeconds:coolingSeconds+betweenSeconds,
      temperaturePhases:s.cooldownMode==='time'?0:clearCount};
  }
  function suggestSweepZ(height) {
    if(!Number.isFinite(height)||height<=0) throw Error('Für den Höhenvorschlag wird eine gültige Bauteilhöhe benötigt.');
    // Start value for contact below the top, not a geometry/collision analysis.
    return Math.round(Math.max(0.2,height-Math.min(10,height/2))*100)/100;
  }
  function analyze(raw) {
    if (raw.includes('\0')) throw Error('Binäre Datei: Bitte Klartext-G-Code oder G-Code-3MF laden.');
    const text = raw.replace(/\r\n?/g,'\n').replace(/^\uFEFF/,'');
    if (/^; (?:=== LOOP |CG_LOOPER)/m.test(text) || /@fl:section|BENDING MOTION/.test(text))
      throw Error('Diese Datei enthält bereits Loops/Ausräumcode. Bitte die unveränderte Ausgangsdatei laden.');
    const model = text.match(/^; printer_model = (.+)$/m)?.[1];
    if (model !== 'Bambu Lab P1S') throw Error('Dieses Profil unterstützt Bambu Lab P1S aus OrcaSlicer. Das erkannte Druckerprofil passt nicht.');
    const firstLayer = text.indexOf('\n; CHANGE_LAYER\n');
    const end = text.lastIndexOf('\n'+END);
    if (firstLayer<0 || end<firstLayer || text.split('\n'+END).length!==2 || !PARK.test(text.slice(end)))
      throw Error('Start-/Endstruktur nicht eindeutig erkannt. Datei wird nicht verändert.');
    if ((text.match(/^; EXECUTABLE_BLOCK_START/gm)||[]).length!==1 || (text.match(/^; EXECUTABLE_BLOCK_END/gm)||[]).length!==1)
      throw Error('Es muss genau ein vollständiger ausführbarer Druckblock vorhanden sein.');
    const endText=text.slice(end);
    for (const line of ['M140 S0 ; turn off bed','M104 S0 ; turn off hotend','M106 S0 ; turn off fan','M106 P2 S0 ; turn off remote part cooling fan','M106 P3 S0 ; turn off chamber cooling fan'])
      if (!endText.includes(line)) throw Error('Nicht unterstützter Endcode: '+line);
    const height=Number(text.match(/^; max_z_height: ([\d.]+)/m)?.[1]);
    const maxZ=Number(text.match(/^; printable_height = ([\d.]+)/m)?.[1]);
    const maxZSpeed=Number(text.match(/^; machine_max_speed_z = ([\d.]+)/m)?.[1]);
    if (![height,maxZ,maxZSpeed].every(v=>Number.isFinite(v)&&v>0)) throw Error('Höhen-/Geschwindigkeitsgrenzen fehlen.');
    if (!/^; printable_area = 0x0,256x0,256x256,0x256$/m.test(text)) throw Error('Abweichender Bauraum: Dieses Profil erwartet 256 × 256 mm.');
    return {text,model,height,maxZ,maxZSpeed,firstLayer,end,sweepSuggestion:suggestSweepZ(height),
      nozzleDiameter:text.match(/^; nozzle_diameter = (.+)$/m)?.[1]?.trim()||null,
      layers:Number(text.match(/^; total layer number: (\d+)/m)?.[1]||0),
      grams:Number(text.match(/^; filament used \[g\] = ([\d.]+)/m)?.[1]||0),
      time:text.match(/total estimated time: ([^\n]+)/)?.[1]||'unbekannt',
      printSeconds:parseDuration(text.match(/total estimated time: ([^\n]+)/)?.[1]),
      bytes:new TextEncoder().encode(text).length};
  }
  function validate(info, input) {
    const s={...defaults,...input}, errors=[];
    // Keep previously saved v1.0 profiles usable without exposing the old name.
    if(s.cooldownMode==='reference')s.cooldownMode='combined';
    for (const [key,[min,max,int]] of Object.entries(numberSpec)) {
      if(key==='cooldownSeconds'&&s.cooldownMode==='temperature')continue;
      if(key==='cooldownTemp'&&s.cooldownMode==='time')continue;
      if(key==='cooldownRepeats'&&s.cooldownMode!=='combined')continue;
      if(key==='postTempSeconds'&&s.cooldownMode!=='temperature')continue;
      const v=s[key];
      if (typeof v!=='number'||!Number.isFinite(v)||v<min||v>max||(int&&!Number.isInteger(v))) errors.push(`${key}: ${min} bis ${max}${int?' (ganzzahlig)':''}.`);
    }
    for (const key of ['rake','fastRake','clearLast','purge']) if(typeof s[key]!=='boolean') errors.push(key+': Wahrheitswert erwartet.');
    if(!['time','combined','temperature'].includes(s.cooldownMode)) errors.push('Ungültiger Kühlmodus.');
    s.xs=typeof s.xPositions==='string'?s.xPositions.split(',').map(v=>v.trim()===''?NaN:Number(v)):[];
    if (!s.xs.length||s.xs.length>30||s.xs.some(v=>!Number.isFinite(v)||v<0||v>256)) errors.push('X-Positionen: 1–30 Zahlen von 0 bis 256, durch Komma getrennt.');
    if(s.bendBase+s.bendDepth>info.maxZ) errors.push(`Biege-Endposition überschreitet Z${info.maxZ}.`);
    if(s.bendBase<=info.height+0.5) errors.push('Biege-Basis muss über der Bauteilhöhe + 0,5 mm liegen.');
    if(s.bendSpeed>info.maxZSpeed) errors.push(`Z-Geschwindigkeit überschreitet ${info.maxZSpeed} mm/s aus der Datei.`);
    if(s.sweepZ>info.maxZ||s.parkZ>info.maxZ) errors.push('Ausräum-/Parkhöhe liegt außerhalb des Bauraums.');
    if(s.rearY<=s.frontY) errors.push('Hintere Y-Position muss größer als die vordere sein.');
    if(!s.centerPasses&&!s.rake&&!s.fastRake) errors.push('Mindestens ein Ausräummuster wählen.');
    if(s.loops*info.bytes>250*1024*1024) errors.push('Ausgabe zu groß (maximal 250 MB). Bitte weniger Loops wählen.');
    if(errors.length) throw Error(errors.join('\n'));
    return s;
  }
  function clearCode(s) {
    let a=['; CG_LOOPER CLEAR START','M400','G90','M140 S0 ; bed off'];
    const speed=Math.round(s.fan*255/100);
    a.push(`M106 S${speed}`,`M106 P2 S${speed}`,`M106 P3 S${speed}`);
    if(s.cooldownMode==='combined') for(let i=0;i<s.cooldownRepeats;i++) a.push(`M190 S${n(s.cooldownTemp)} ; temperature request ${i+1}/${s.cooldownRepeats}`);
    if(s.cooldownMode==='temperature') a.push(
      '; Temperature wait is handled by the P1S firmware, including its tolerance/timeouts.',
      `M190 S${n(s.cooldownTemp)} ; wait for bed temperature (P1S)`,
      'M400 ; synchronize before plate bending');
    if(s.cooldownMode!=='temperature'&&s.cooldownSeconds) a.push(`G4 S${s.cooldownSeconds} ; fixed cooling time`);
    if(s.cooldownMode==='temperature'&&s.postTempSeconds) a.push(`G4 S${s.postTempSeconds} ; one additional wait after temperature release`);
    a.push('M140 S0','; BENDING MOTION');
    for(let i=0;i<s.bends;i++) a.push(`G1 Z${n(s.bendBase+s.bendDepth)} F${n(s.bendSpeed*60)}`,`G1 Z${n(s.bendBase)} F${n(s.bendSpeed*60)}`);
    a.push('; PUSH SECTION',`G1 Z${n(s.sweepZ)} F${n(s.bendSpeed*60)}`,'M400');
    if(s.centerPasses){a.push('; CENTER SWEEPS',`G1 X125 F${n(s.sweepSpeed*60)}`);for(let i=0;i<s.centerPasses;i++)a.push(`G1 Y${n(s.rearY)} F${n(s.sweepSpeed*60)}`,`G1 Y${n(s.frontY)} F${n(s.sweepSpeed*60)}`);}
    for(const [enabled,speed,label] of [[s.rake,s.sweepSpeed,'SLOW'],[s.fastRake,s.fastSpeed,'FAST']]) if(enabled) {
      a.push('; RAKE '+label);for(const x of s.xs)a.push(`G1 Y${n(s.rearY)} F${n(speed*60)}`,`G1 X${n(x)} F${n(speed*60)}`,`G1 Y${n(s.frontY)} F${n(speed*60)}`);
    }
    a.push('; PARK TOOLHEAD','M400','G1 X65 Y245 F12000','G1 Y265 F3000','M400','M106 S0','M106 P2 S0','M106 P3 S0','; CG_LOOPER CLEAR END');
    return a.join('\n')+'\n';
  }
  function motionPreview(info,s,code) {
    // Read the known absolute service position from the original end code.
    const state={x:null,y:null,z:null};let absolute=true,feed=0;
    function readMove(line){
      const c=line.split(';')[0].trim();if(c==='G90')absolute=true;if(c==='G91')absolute=false;
      if(!/^G[01]\s/.test(c))return null;
      const next={...state};
      for(const m of c.matchAll(/([XYZF])\s*(-?(?:\d+(?:\.\d*)?|\.\d+))/g)){
        const key=m[1].toLowerCase(),v=Number(m[2]);
        if(key==='f')feed=v;else next[key]=absolute?v:(next[key]===null?null:next[key]+v);
      }
      Object.assign(state,next);return {...state};
    }
    const prefix=info.text.slice(info.end).split(PARK)[0];
    for(const line of prefix.split('\n'))readMove(line);
    if(Object.values(state).some(v=>!Number.isFinite(v)))return null;
    const initial={...state},moves=[];let phase='Biegen',elapsed=0,distance=0;
    const phases={'BENDING MOTION':'Biegen','PUSH SECTION':'Ausräumhöhe anfahren','CENTER SWEEPS':'Mittelfahrten','RAKE SLOW':'Rechenfahrt','RAKE FAST':'Schnelle Rechenfahrt','PARK TOOLHEAD':'Parken'};
    const lines=(code+`; PARK TOOLHEAD\nG1 Z${n(s.parkZ)} F600\n`).split('\n');
    for(const line of lines){
      const marker=line.replace(/^;\s*/,'').trim();if(phases[marker])phase=phases[marker];
      const from={...state},to=readMove(line);if(!to)continue;
      const length=Math.hypot(to.x-from.x,to.y-from.y,to.z-from.z);if(length<1e-8)continue;
      const seconds=length/(feed/60);
      moves.push({from,to,phase,seconds,start:elapsed,end:elapsed+seconds,feed,line});elapsed+=seconds;distance+=length;
    }
    return {initial,moves,seconds:elapsed,distance};
  }
  function timing(info,s,motion) {
    const waits=waitTimes(s),printSeconds=info.printSeconds===null?null:info.printSeconds*s.loops;
    const motionSeconds=waits.clearCount===0?0:motion?motion.seconds*waits.clearCount:null;
    const knownSeconds=printSeconds===null||motionSeconds===null?null:printSeconds+waits.fixedSeconds+motionSeconds;
    return {waits,singlePrintSeconds:info.printSeconds,printSeconds,motionSeconds,knownSeconds};
  }
  function prepare(info,s,clear) {
    let start=info.text.slice(0,info.firstLayer), body=info.text.slice(info.firstLayer,info.end), end=info.text.slice(info.end);
    if(s.purge) {
      const re=/^;===== nozzle load line [^\n]*\n[\s\S]*?(?=^;===== for Textured PEI Plate)/m;
      const old=start.match(re)?.[0], temp=old?.match(/^M109 S([\d.]+)/m)?.[1];
      if(!old||!temp) throw Error('Spüllinie nicht erkannt. Option „Spülen im Abwurfschacht“ deaktivieren.');
      start=start.replace(re,[';===== nozzle load line (CG Looper chute purge) =====',`M109 S${temp}`,'M975 S1','G90','M83','T1000','G1 X60 F21000','G1 Y245','G1 Y265 F3000','G92 E0',`G1 E${n(s.purgeLength)} F${n(s.purgeSpeed)}`,'M400','G1 X100 F21000','M400',''].join('\n')+'\n');
    }
    if(clear) {
      const speed=Math.round(s.fan*255/100);
      end=end.replace('M106 S0 ; turn off fan',`M106 S${speed} ; cooldown fan`).replace('M106 P2 S0 ; turn off remote part cooling fan',`M106 P2 S${speed} ; cooldown fan`).replace('M106 P3 S0 ; turn off chamber cooling fan',`M106 P3 S${speed} ; cooldown fan`);
      end=end.replace(PARK,match=>clearCode(s)+match);
      // Only replace the two known park Z moves following the reduced-current command.
      const re=/(M17 Z0\.4[^\n]*\n\s*)G1 Z[\d.]+ F600\n\s*G1 Z[\d.]+/;
      if(!re.test(end)) throw Error('Parkbewegung nicht erkannt.');
      end=end.replace(re,`$1G1 Z${n(s.parkZ)} F600\n    G1 Z${n(s.parkZ)}`);
    }
    return start+body+end;
  }
  function generate(info,input) {
    const s=validate(info,input), parts=[`; CG_LOOPER v1.4 | ${s.loops} prints | printer P1S\n; CG_LOOPER settings ${JSON.stringify(s)}\n`];
    const cleared=prepare(info,s,true), untouched=prepare(info,s,false);
    for(let i=1;i<=s.loops;i++) {
      parts.push(`\n; === LOOP ${i} OF ${s.loops} ===\n`,(i<s.loops||s.clearLast)?cleared:untouched,`\n; === END OF LOOP ${i} ===\n`);
      if(i<s.loops)parts.push(`M400\nG4 S${s.pause} ; pause between prints\n`);
    }
    const warnings=['Profil: P1S mit passender Ausräummechanik. Bewegungen wurden nicht am Drucker erprobt.',
      'Start, Homing, Kalibrierung und AMS-Ablauf werden je Druck wiederholt. Fortschritt/Zeit im Drucker beziehen sich weiterhin auf den einzelnen Durchlauf.'];
    if(s.cooldownMode==='combined') warnings.push('Temperaturbefehle plus feste Kühlpause: Die zusätzliche Zeit garantiert nicht, dass die Zieltemperatur erreicht wurde.');
    else if(s.cooldownMode==='temperature') warnings.push(`Der P1S erhält einen Wartebefehl für ${n(s.cooldownTemp)} °C. Die Freigabe erfolgt durch seine Firmware; Toleranzen und mögliche Zeitlimits bleiben wirksam. Eine strikt eingehaltene Temperaturgrenze ist mit diesem G-Code nicht garantiert.`);
    else warnings.push('Zeitgesteuerte Kühlung: Die App prüft keine tatsächliche Betttemperatur. Wartezeit am Gerät passend einstellen.');
    if(s.sweepZ>=info.height) warnings.push('Ausräumhöhe liegt auf/über der Bauteilhöhe – möglicherweise kein Kontakt.');
    const preview=clearCode(s),motion=motionPreview(info,s,preview);
    return {parts,settings:s,warnings,preview,motion,timing:timing(info,s,motion),clearCount:s.loops-(s.clearLast?0:1)};
  }
  function scheduleJobs(jobs,order) {
    if(!['alternating','batch'].includes(order))throw Error('Ungültige Druckreihenfolge.');
    if(!jobs.length)throw Error('Bitte mindestens eine Datei hinzufügen.');
    if(jobs.some(j=>!Number.isInteger(j.count)||j.count<1||j.count>100))throw Error('Anzahl je Datei: ganze Zahl von 1 bis 100.');
    const total=jobs.reduce((n,j)=>n+j.count,0);if(total>100)throw Error('Maximal 100 Drucke insgesamt.');
    const plan=[];
    if(order==='batch')jobs.forEach((j,index)=>{for(let copy=0;copy<j.count;copy++)plan.push(index);});
    else for(let copy=0;copy<Math.max(...jobs.map(j=>j.count));copy++)jobs.forEach((j,index)=>{if(copy<j.count)plan.push(index);});
    return plan;
  }
  function generateQueue(jobs,input,order='alternating') {
    const plan=scheduleJobs(jobs,order),total=plan.length;
    if(jobs.length>1&&(jobs.some(j=>!j.info.nozzleDiameter)||new Set(jobs.map(j=>j.info.nozzleDiameter)).size!==1))throw Error('Alle Dateien müssen dieselbe angegebene Düsendurchmesser-Konfiguration verwenden.');
    if(jobs.reduce((v,j)=>v+j.info.bytes*j.count,0)>250*1024*1024)throw Error('Gesamtausgabe zu groß (maximal 250 MB).');
    const prepared=jobs.map(j=>{
      const s=validate(j.info,{...input,loops:1,sweepZ:j.sweepZ});
      return {s,clear:prepare(j.info,s,true),final:prepare(j.info,s,false),details:generate(j.info,s)};
    });
    const settings={...prepared[0].s,loops:total},parts=[`; CG_LOOPER v1.4 | ${total} prints | ${jobs.length} files | ${order}\n`];
    const counts=jobs.map(()=>0);let printSeconds=0,motionSeconds=0,grams=0;
    plan.forEach((index,step)=>{
      const j=jobs[index],p=prepared[index],clear=step<total-1||settings.clearLast;
      const name=String(j.name||`Datei ${index+1}`).replace(/[\r\n]/g,' ');
      parts.push(`\n; === LOOP ${step+1} OF ${total} ===\n; CG_LOOPER FILE ${index+1}: ${name} | copy ${++counts[index]} of ${j.count}\n`,clear?p.clear:p.final,`\n; === END OF LOOP ${step+1} ===\n`);
      if(step<total-1)parts.push(`M400\nG4 S${settings.pause} ; pause between prints\n`);
      printSeconds=printSeconds===null||j.info.printSeconds===null?null:printSeconds+j.info.printSeconds;
      if(clear)motionSeconds=motionSeconds===null||!p.details.motion?null:motionSeconds+p.details.motion.seconds;
      grams+=j.info.grams;
    });
    const waits=waitTimes(settings),knownSeconds=printSeconds===null||motionSeconds===null?null:printSeconds+waits.fixedSeconds+motionSeconds;
    return {parts,settings,plan,grams,clearCount:waits.clearCount,details:prepared.map(p=>p.details),
      timing:{waits,singlePrintSeconds:jobs.length===1?jobs[0].info.printSeconds:null,printSeconds,motionSeconds,knownSeconds},
      warnings:[...new Set(prepared.flatMap(p=>p.details.warnings))]};
  }
  return {defaults,numberSpec,analyze,validate,generate,generateQueue,scheduleJobs,clearCode,suggestSweepZ,parseDuration,waitTimes,motionPreview};
})();
if(typeof module!=='undefined')module.exports=Looper;
