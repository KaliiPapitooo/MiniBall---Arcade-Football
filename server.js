const http=require('http'),fs=require('fs'),path=require('path');
const {WebSocketServer,WebSocket}=require('ws');
const PORT=Number(process.env.PORT||3000),rooms=new Map();let nextId=1;
const send=(ws,m)=>{if(ws&&ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(m));};
const name=x=>String(x||'Gracz').trim().replace(/[<>]/g,'').slice(0,12)||'Gracz';
const code=()=>{let c;do{c=Math.random().toString(36).slice(2,8).toUpperCase()}while(rooms.has(c));return c;};
const presets={1:{size:'medium',ballSize:11,shotPower:200,powerShotSpeed:70,chargeTime:.6,slideDistance:100},2:{size:'large',ballSize:11,shotPower:250,powerShotSpeed:70,chargeTime:.6,slideDistance:100},3:{size:'real',ballSize:11,shotPower:300,powerShotSpeed:70,chargeTime:.6,slideDistance:100},4:{size:'real4',ballSize:11,shotPower:300,powerShotSpeed:70,chargeTime:.6,slideDistance:100}};
const defaults={...presets[1],ballFriction:.987,stadium:'classic',keepersEnabled:false};
const ranges={ballSize:[6,18],shotPower:[20,400],powerShotSpeed:[20,150],chargeTime:[.3,3],slideDistance:[40,250],ballFriction:[.95,1]};
const sizes=['medium','large','real','real4'];
const server=http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 if(pathname==='/miniball_gameplay_background.mp4'){
  const videoPath=path.join(__dirname,'miniball_gameplay_background.mp4');
  fs.stat(videoPath,(err,stat)=>{
   if(err||!stat.isFile()){res.writeHead(404);res.end('Video not found');return;}
   const range=req.headers.range;
   const common={'Content-Type':'video/mp4','Accept-Ranges':'bytes','Cache-Control':'public, max-age=3600'};
   if(range){
    const match=/^bytes=(\d*)-(\d*)$/.exec(range);
    if(!match){res.writeHead(416,{'Content-Range':`bytes */${stat.size}`});res.end();return;}
    let start=match[1]?Number(match[1]):0;
    let end=match[2]?Number(match[2]):stat.size-1;
    if(!match[1]&&match[2]){const suffix=Number(match[2]);start=Math.max(0,stat.size-suffix);end=stat.size-1;}
    if(start>=stat.size||end<start){res.writeHead(416,{'Content-Range':`bytes */${stat.size}`});res.end();return;}
    end=Math.min(end,stat.size-1);
    res.writeHead(206,{...common,'Content-Range':`bytes ${start}-${end}/${stat.size}`,'Content-Length':end-start+1});
    fs.createReadStream(videoPath,{start,end}).pipe(res);
   }else{
    res.writeHead(200,{...common,'Content-Length':stat.size});
    fs.createReadStream(videoPath).pipe(res);
   }
  });
  return;
 }
 if(pathname!=='/'&&pathname!=='/index.html'){res.writeHead(404);res.end();return;}
 fs.readFile(path.join(__dirname,'index.html'),(err,body)=>{
  if(err){res.writeHead(500);res.end('Missing index.html');return;}
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(body);
 });
});
const wss=new WebSocketServer({server,maxPayload:1500000});
function announce(r){const players=[...r.members.values()].map(p=>({id:p.id,name:p.name,team:p.team,ready:p.ready,host:p.ws===r.host}));for(const p of r.members.values())send(p.ws,{type:'room',code:r.code,role:p.ws===r.host?'host':'guest',selfId:p.id,roster:players,settings:r.settings,mode:r.mode,hostOnRight:r.hostOnRight,status:r.started?'playing':'waiting',players:players.map(p=>p.name),hostReady:players[0]?.ready,guestReady:players[1]?.ready,ready:players.length>1});}
function leave(ws){const r=ws.room;if(!r)return;ws.room=null;const p=r.members.get(ws);r.members.delete(ws);if(ws===r.host){for(const other of r.members.values()){other.ws.room=null;send(other.ws,{type:'closed',message:'Gospodarz opuścił pokój.'});}rooms.delete(r.code);return;}if(r.started&&p.team!=='spectator'){for(const other of r.members.values())send(other.ws,{type:'peerLeft',id:p.id});}else{for(const other of r.members.values())other.ready=false;}announce(r);}
function updateReady(r){for(const p of r.members.values())p.ready=false;}
function counts(r){const c={blue:0,red:0};for(const p of r.members.values())if(p.team==='blue'||p.team==='red')c[p.team]++;return c;}
function broadcast(r,msg,except=null){for(const p of r.members.values())if(p.ws!==except)send(p.ws,msg);}
wss.on('connection',ws=>{ws.on('message',raw=>{let m;try{m=JSON.parse(raw)}catch{return;}if(!m||typeof m!=='object')return;
 if(m.type==='create'){leave(ws);const r={code:code(),host:ws,members:new Map(),mode:1,settings:{...defaults},hostOnRight:false,started:false};r.members.set(ws,{ws,id:nextId++,name:name(m.name),team:'blue',ready:false});rooms.set(r.code,r);ws.room=r;announce(r);return;}
 if(m.type==='watch'){leave(ws);const r=rooms.get(String(m.code||'').toUpperCase().trim());if(!r){send(ws,{type:'error',message:'Nie znaleziono pokoju.'});return;}r.members.set(ws,{ws,id:nextId++,name:name(m.name),team:'spectator',ready:true});ws.room=r;announce(r);if(r.started)send(ws,{type:'watchStart',settings:r.settings,mode:r.mode,hostOnRight:r.hostOnRight,roster:[...r.members.values()].filter(x=>x.team!=='spectator').map(x=>({id:x.id,name:x.name,team:x.team}))});return;}
 if(m.type==='join'){leave(ws);const r=rooms.get(String(m.code||'').toUpperCase().trim());if(!r){send(ws,{type:'error',message:'Nie znaleziono pokoju.'});return;}if(r.started||counts(r).blue+counts(r).red>=r.mode*2){send(ws,{type:'error',message:'Mecz trwa lub drużyny są pełne. Wybierz OGLĄDAJ MECZ.'});return;}const c=counts(r);const team=c.red<=c.blue?'red':'blue';r.members.set(ws,{ws,id:nextId++,name:name(m.name),team,ready:false});ws.room=r;updateReady(r);announce(r);return;}
 if(m.type==='leave'){leave(ws);return;}const r=ws.room;if(!r)return;const p=r.members.get(ws);if(!p)return;const host=ws===r.host;
 if(m.type==='profile'&&p.team!=='spectator'){p.name=name(m.data?.name||p.name);broadcast(r,{type:'profile',id:p.id,data:{name:p.name,jersey:Math.max(0,Math.min(99,Number(m.data?.jersey)||0)),color:/^#[\da-f]{6}$/i.test(m.data?.color)?m.data.color:(p.team==='blue'?'#49a5ff':'#ff6268'),jerseyColor:/^#[\da-f]{6}$/i.test(m.data?.jerseyColor)?m.data.jerseyColor:'#ffffff'}} ,ws);if(!r.started)announce(r);return;}
 if(!r.started){
  if(m.type==='ready'&&p.team!=='spectator'){p.ready=!!m.value;announce(r);return;}
  if(m.type==='spectate'&&!host){p.team='spectator';p.ready=true;announce(r);return;}
  if(m.type==='team'){const team=m.team==='blue'?'blue':'red';if(team!==p.team&&counts(r)[team]<r.mode){p.team=team;updateReady(r);}announce(r);return;}
  if(m.type==='mode'&&host){const v=Number(m.value);if(![1,2,3,4].includes(v))return;if(counts(r).blue+counts(r).red>v*2){send(ws,{type:'error',message:'Za dużo graczy na wybrany tryb.'});return;}const c=counts(r);if(c.blue>v||c.red>v){send(ws,{type:'error',message:'Najpierw przenieś graczy między drużynami.'});return;}r.mode=v;r.settings={...r.settings,...presets[v],keepersEnabled:v!==1};updateReady(r);announce(r);return;}
  if(m.type==='settings'&&host){for(const [key,val] of Object.entries(m.data||{})){if(key==='size')continue;if(key==='keepersEnabled'){if(typeof val==='boolean')r.settings.keepersEnabled=r.mode!==1&&val;continue;}if(key==='stadium'){if(['classic','night','winter','indoor'].includes(val))r.settings.stadium=val;continue;}if(!ranges[key])continue;const n=Number(val);if(Number.isFinite(n))r.settings[key]=Math.min(ranges[key][1],Math.max(ranges[key][0],n));}if(r.started){broadcast(r,{type:'stadiumChange',stadium:r.settings.stadium});}else{updateReady(r);announce(r);}return;}
  if(m.type==='swap'&&host){r.hostOnRight=!r.hostOnRight;updateReady(r);announce(r);return;}
  if(m.type==='start'&&host){const c=counts(r);if(c.blue!==r.mode||c.red!==r.mode||[...r.members.values()].some(x=>x.team!=='spectator'&&!x.ready)){send(ws,{type:'error',message:'Potrzeba pełnych drużyn i gotowości wszystkich graczy.'});return;}r.started=true;broadcast(r,{type:'start',hostOnRight:r.hostOnRight,roster:[...r.members.values()].filter(p=>p.team!=='spectator').map(p=>({id:p.id,name:p.name,team:p.team})),settings:r.settings,mode:r.mode});announce(r);return;}
  return;
 }
 if(m.type==='ping'){send(ws,{type:'pong',sent:m.sent});return;}
 if(m.type==='fx'&&host){broadcast(r,{type:'fx',kind:m.kind,id:m.id},ws);return;}
 if(m.type==='skill'&&!host&&p.team!=='spectator'&&r.started&&['ballroll'].includes(m.kind)){send(r.host,{type:'skill',id:p.id,kind:m.kind,direction:['w','a','s','d'].includes(m.direction)?m.direction:null});return;}
 if(m.type==='input'&&!host&&p.team!=='spectator'){const keys=Array.isArray(m.keys)?m.keys.filter(k=>['w','a','s','d','shift',' '].includes(k)).slice(0,6):[];send(r.host,{type:'input',id:p.id,keys,charge:Math.max(0,Math.min(3,Number(m.charge)||0)),release:!!m.release,ghost:!!m.ghost});}
 if(m.type==='state'&&host)broadcast(r,{type:'state',data:m.data},ws);
 if(m.type==='goalReplay'&&host)broadcast(r,{type:'goalReplay',frames:Array.isArray(m.frames)?m.frames.slice(-170):[],scorer:m.scorer,card:m.card},ws);
 });ws.on('close',()=>leave(ws));ws.on('error',()=>{});});
server.listen(PORT,'0.0.0.0',()=>console.log(`MiniBall v15: http://localhost:${PORT}`));
