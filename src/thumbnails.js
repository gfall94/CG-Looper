'use strict';
function jobThumbnail(info,entries,path){
  const stem=path?.replace(/\.gcode$/i,''),image=entries?.find(e=>e.name===stem+'.png')||entries?.find(e=>e.name===stem+'_small.png');
  if(image&&image.data.length<8*1024*1024&&image.data[0]===137&&image.data[1]===80){
    return {url:URL.createObjectURL(new Blob([image.data],{type:'image/png'})),kind:'3MF-Vorschaubild',blob:true};
  }
  // Plain G-code has no guaranteed thumbnail: show a clearly labelled first-layer path.
  const canvas=document.createElement('canvas');canvas.width=200;canvas.height=150;const ctx=canvas.getContext('2d');
  ctx.fillStyle='#111a1e';ctx.fillRect(0,0,200,150);
  const next=info.text.indexOf('\n; CHANGE_LAYER\n',info.firstLayer+1),lines=info.text.slice(info.firstLayer,next<0?info.end:next).split('\n');
  let x=null,y=null;const segments=[];
  for(const line of lines){const c=line.split(';')[0];if(!/^G[0123]\s/.test(c))continue;const nx=c.match(/\bX(-?[\d.]+)/),ny=c.match(/\bY(-?[\d.]+)/),e=c.match(/\bE(-?[\d.]+)/);const ax=nx?Number(nx[1]):x,ay=ny?Number(ny[1]):y;
    if(e&&Number(e[1])>0&&[x,y,ax,ay].every(v=>v!==null&&Number.isFinite(v)))segments.push([x,y,ax,ay]);x=ax;y=ay;
  }
  if(segments.length){let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;for(const [a,b,c,d]of segments){minX=Math.min(minX,a,c);maxX=Math.max(maxX,a,c);minY=Math.min(minY,b,d);maxY=Math.max(maxY,b,d);}const scale=Math.min(180/Math.max(maxX-minX,1),130/Math.max(maxY-minY,1));const px=x=>100+(x-(minX+maxX)/2)*scale,py=y=>75-(y-(minY+maxY)/2)*scale;ctx.strokeStyle='#c5fa72';ctx.lineWidth=1;ctx.beginPath();for(const[a,b,c,d]of segments){ctx.moveTo(px(a),py(b));ctx.lineTo(px(c),py(d));}ctx.stroke();}
  else{ctx.fillStyle='#a7b5ba';ctx.font='14px sans-serif';ctx.fillText('Keine Vorschau',45,80);}
  return {url:canvas.toDataURL('image/png'),kind:segments.length?'2D-Bahnvorschau · erste Schicht':'Kein Vorschaubild',blob:false};
}
