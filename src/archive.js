'use strict';
// ZIP reader/writer uses browser-native raw DEFLATE. No external scripts or network.
const Archive = (() => {
 const enc=new TextEncoder(),dec=new TextDecoder('utf-8',{fatal:true});
 const table=Uint32Array.from({length:256},(_,i)=>{for(let j=0;j<8;j++)i=(i>>>1)^((i&1)?0xedb88320:0);return i>>>0;});
 function crc(data){let c=0xffffffff;for(const b of data)c=table[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
 function md5(data){
  const len=data.length,pad=new Uint8Array(((len+8>>>6)+1)*64);pad.set(data);pad[len]=128;
  const v=new DataView(pad.buffer);v.setUint32(pad.length-8,(len*8)>>>0,true);v.setUint32(pad.length-4,Math.floor(len/536870912),true);
  const shifts=[7,12,17,22,5,9,14,20,4,11,16,23,6,10,15,21],k=Array.from({length:64},(_,i)=>Math.floor(Math.abs(Math.sin(i+1))*4294967296)|0);
  let state=[0x67452301,0xefcdab89|0,0x98badcfe|0,0x10325476];
  for(let offset=0;offset<pad.length;offset+=64){let[a,b,c,d]=state;
   for(let i=0;i<64;i++){let f,g;if(i<16){f=(b&c)|(~b&d);g=i;}else if(i<32){f=(d&b)|(~d&c);g=(5*i+1)%16;}else if(i<48){f=b^c^d;g=(3*i+5)%16;}else{f=c^(b|~d);g=7*i%16;}
    let q=(a+f+k[i]+v.getInt32(offset+g*4,true))|0,s=shifts[(i>>4)*4+i%4];[a,b,c,d]=[d,(b+((q<<s)|(q>>>(32-s))))|0,b,c];}
   state=state.map((x,i)=>(x+[a,b,c,d][i])|0);
  }
  return state.map(x=>Array.from({length:4},(_,i)=>((x>>>(i*8))&255).toString(16).padStart(2,'0')).join('')).join('').toUpperCase();
 }
 async function read(buffer){
  if(buffer.byteLength>100*1024*1024)throw Error('Eingabedatei zu groß (maximal 100 MB).');
  const v=new DataView(buffer),b=new Uint8Array(buffer),u16=p=>v.getUint16(p,true),u32=p=>v.getUint32(p,true);
  let e=-1;for(let p=b.length-22;p>=Math.max(0,b.length-65557);p--)if(u32(p)===0x06054b50&&p+22+u16(p+20)===b.length){e=p;break;}
  if(e<0)throw Error('Ungültiges ZIP/3MF-Archiv.');
  if(u16(e+4)||u16(e+6)||u16(e+8)!==u16(e+10)||u16(e+10)===65535)throw Error('Mehrteilige/ZIP64-Archive werden nicht unterstützt.');
  let at=u32(e+16),total=0,entries=[];const names=new Set();
  if(at+u32(e+12)>e)throw Error('Beschädigtes ZIP-Verzeichnis.');
  for(let i=0;i<u16(e+10);i++){
   if(u32(at)!==0x02014b50)throw Error('Beschädigtes ZIP-Verzeichnis.');
   const flags=u16(at+8),method=u16(at+10),checksum=u32(at+16),size=u32(at+20),rawSize=u32(at+24),nl=u16(at+28),el=u16(at+30),cl=u16(at+32),off=u32(at+42);
   const name=dec.decode(b.subarray(at+46,at+46+nl));at+=46+nl+el+cl;
   if(flags&1||![0,8].includes(method))throw Error('Verschlüsseltes oder nicht unterstütztes ZIP.');
   if(names.has(name)||name.includes('..')||name.startsWith('/'))throw Error('Ungültiger oder doppelter ZIP-Pfad.');names.add(name);
   total+=rawSize;if(total>250*1024*1024||entries.length>5000)throw Error('Entpacktes Archiv zu groß.');
   if(u32(off)!==0x04034b50)throw Error('Beschädigter ZIP-Eintrag.');
   const start=off+30+u16(off+26)+u16(off+28);if(start+size>b.length)throw Error('Unvollständiger ZIP-Eintrag.');
   const compressed=b.subarray(start,start+size);let data=compressed;
   if(method===8){
    let stream;try{stream=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'));}catch{throw Error('Bitte einen aktuellen Edge-, Chrome- oder Firefox-Browser verwenden.');}
    const reader=stream.getReader(),chunks=[];let count=0;
    for(;;){const {done,value}=await reader.read();if(done)break;count+=value.length;if(count>rawSize){await reader.cancel();throw Error('ZIP-Größenprüfung fehlgeschlagen.');}chunks.push(value);}
    data=new Uint8Array(count);let p=0;for(const chunk of chunks){data.set(chunk,p);p+=chunk.length;}
   }
   if(data.length!==rawSize||crc(data)!==checksum)throw Error('ZIP-Prüfsumme fehlerhaft: '+name);
   entries.push({name,data});
  }
  return entries;
 }
 function write(entries){
  let offset=0;const local=[],central=[];
  for(const {name,data} of entries){const nb=enc.encode(name),c=crc(data),h=new Uint8Array(30+nb.length),v=new DataView(h.buffer);
   v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint32(14,c,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,nb.length,true);h.set(nb,30);
   const ch=new Uint8Array(46+nb.length),cv=new DataView(ch.buffer);cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(8,0x800,true);cv.setUint32(16,c,true);cv.setUint32(20,data.length,true);cv.setUint32(24,data.length,true);cv.setUint16(28,nb.length,true);cv.setUint32(42,offset,true);ch.set(nb,46);
   local.push(h,data);central.push(ch);offset+=h.length+data.length;
  }
  const end=new Uint8Array(22),v=new DataView(end.buffer);v.setUint32(0,0x06054b50,true);v.setUint16(8,entries.length,true);v.setUint16(10,entries.length,true);v.setUint32(12,central.reduce((a,b)=>a+b.length,0),true);v.setUint32(16,offset,true);
  return new Blob([...local,...central,end],{type:'application/vnd.ms-package.3dmanufacturing-3dmodel+xml'});
 }
 function pack(entries,path,text){
  const data=enc.encode(text),sum=enc.encode(md5(data));let seen=false;
  const out=entries.map(e=>{if(e.name===path)return{name:path,data};if(e.name===path+'.md5'){seen=true;return{name:e.name,data:sum};}return e;});
  if(!seen)out.push({name:path+'.md5',data:sum});return write(out);
 }
 return {read,write,pack,crc,md5};
})();
if(typeof module!=='undefined')module.exports=Archive;
