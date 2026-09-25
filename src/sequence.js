'use strict';
// Two orthogonal views of the actual generated G1 moves. Playback is local only.
class SequenceView {
  constructor(){
    this.data=null;this.time=0;this.frame=0;this.last=0;this.phase='';
    const el=id=>document.getElementById(id);this.el=el;
    el('sequencePlay').addEventListener('click',()=>this.frame?this.pause():this.play());
    el('sequenceReset').addEventListener('click',()=>{this.pause();this.time=0;this.render();});
    el('sequenceSeek').addEventListener('input',()=>{this.pause();if(this.data){this.time=this.data.seconds*Number(el('sequenceSeek').value)/1000;this.render();}});
    document.addEventListener('visibilitychange',()=>{if(document.hidden)this.pause();});
  }
  xy(p){return {x:35+p.x*0.88,y:265-p.y*0.83};}
  z(p){return 265-p.z*0.83;}
  path(moves){return moves.map(m=>{const a=this.xy(m.from),b=this.xy(m.to);return `M${a.x} ${a.y}L${b.x} ${b.y}`;}).join(' ');}
  setData(data,clearCount){
    this.pause();this.data=clearCount?data:null;this.time=0;this.phase='';
    for(const id of ['sequencePlay','sequenceReset','sequenceSeek','sequenceSpeed'])this.el(id).disabled=!this.data;
    this.el('sequencePlan').setAttribute('d',this.data?this.path(this.data.moves):'');
    this.el('sequenceHint').textContent=!clearCount?'Kein Ausräumen in dieser Serie eingestellt.':data?`${clearCount} Ausräumvorgänge in der Serie. Vorschau eines Vorgangs nach dem Abkühlen, inklusive Biegen und Parken.`:'Datei laden und gültige Einstellungen wählen, um die Bewegungsvorschau zu sehen.';
    this.render();
  }
  pause(){if(this.frame)cancelAnimationFrame(this.frame);this.frame=0;this.el('sequencePlay').textContent='Abspielen';}
  play(){
    if(!this.data)return;if(this.time>=this.data.seconds)this.time=0;
    this.last=performance.now();this.el('sequencePlay').textContent='Pause';
    const tick=now=>{
      this.time=Math.min(this.data.seconds,this.time+(now-this.last)/1000*Number(this.el('sequenceSpeed').value));this.last=now;this.render();
      if(this.time>=this.data.seconds)this.pause();else this.frame=requestAnimationFrame(tick);
    };this.frame=requestAnimationFrame(tick);
  }
  render(){
    if(!this.data){
      this.el('sequencePassed').setAttribute('d','');this.el('sequenceActive').setAttribute('d','');
      for(const id of ['sequenceHead','sequenceZ'])this.el(id).setAttribute('visibility','hidden');
      this.el('sequenceSeek').value=0;this.el('sequenceStage').textContent='Keine Bewegungsvorschau';this.el('sequencePosition').textContent='X — · Y — · Z —';return;
    }
    const index=this.data.moves.findIndex(m=>this.time<m.end),i=index<0?this.data.moves.length-1:index,m=this.data.moves[i];
    if(!m)return;
    const t=Math.max(0,Math.min(1,(this.time-m.start)/m.seconds));
    const p={x:m.from.x+(m.to.x-m.from.x)*t,y:m.from.y+(m.to.y-m.from.y)*t,z:m.from.z+(m.to.z-m.from.z)*t};
    const a=this.xy(m.from),b=this.xy(p);
    this.el('sequencePassed').setAttribute('d',this.path(this.data.moves.slice(0,i)));
    this.el('sequenceActive').setAttribute('d',`M${a.x} ${a.y}L${b.x} ${b.y}`);
    this.el('sequenceHead').setAttribute('cx',b.x);this.el('sequenceHead').setAttribute('cy',b.y);
    this.el('sequenceZ').setAttribute('cy',this.z(p));
    for(const id of ['sequenceHead','sequenceZ'])this.el(id).setAttribute('visibility','visible');
    this.el('sequenceSeek').value=Math.round(this.time/this.data.seconds*1000);
    const phase=this.time>=this.data.seconds?'Abgeschlossen':m.phase;
    if(phase!==this.phase){this.el('sequenceStage').textContent=phase;this.phase=phase;}
    this.el('sequencePosition').textContent=`X ${p.x.toFixed(1)} · Y ${p.y.toFixed(1)} · Z ${p.z.toFixed(1)} mm · ${Math.round(this.time)} / ${Math.ceil(this.data.seconds)} s Bewegungszeit (idealisiert)`;
  }
}
