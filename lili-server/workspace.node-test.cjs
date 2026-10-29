const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
let child,base,dir;
before(async()=>{
 dir=fs.mkdtempSync(path.join(os.tmpdir(),'lili-storage-test-'));
 child=spawn(process.execPath,[path.join(__dirname,'storage.js')],{env:{...process.env,PORT:'0',DATA_DIR:dir},stdio:['ignore','pipe','pipe']});
 base=await new Promise((resolve,reject)=>{let data='';const timer=setTimeout(()=>reject(new Error('server timeout')),10000);child.stdout.on('data',chunk=>{data+=chunk;const match=/on (\d+)/.exec(data);if(match){clearTimeout(timer);resolve(`http://127.0.0.1:${match[1]}/storage`);}});child.once('error',reject);});
});
after(async()=>{child?.kill();await new Promise(r=>child?.once('exit',r));fs.rmSync(dir,{recursive:true,force:true});});
const teacher='a'.repeat(64),student='b'.repeat(64);
const request=(url,method='GET',body,token)=>fetch(base+url,{method,headers:{'Content-Type':'application/json',...token?{Authorization:`Bearer ${token}`} :{}},body:body===undefined?undefined:JSON.stringify(body)});
test('legacy rooms keep working; claims enforce credentials and protected-layer ownership',async()=>{
 const scene={iv:'iv',ciphertext:'encrypted work',sceneVersion:1};
 assert.equal((await request('/scenes/room?rev=0','PUT',scene)).status,200);
 assert.equal((await request('/workspaces/room','POST',{studentToken:student},teacher)).status,201);
 assert.equal((await request('/workspaces/room','POST',{studentToken:student},teacher)).status,409);
 assert.equal((await request('/scenes/room?rev=1','PUT',scene)).status,403);
 assert.equal((await request('/scenes/room?rev=1','PUT',scene,student)).status,200);
 assert.equal((await request('/workspaces/room','PUT',{revision:1,protected:{iv:'p',ciphertext:'teacher sheet'}},student)).status,403);
 assert.equal((await request('/workspaces/room','PUT',{revision:1,protected:{iv:'p',ciphertext:'teacher sheet'},teacherSocketId:'teacher-live'},teacher)).status,200);
 assert.equal((await request('/workspaces/room','PUT',{revision:1,protected:null},teacher)).status,409);
 const meta=await (await request('/workspaces/room')).json();
 assert.equal(meta.role,'visitor');assert.equal(meta.protected.ciphertext,'teacher sheet');assert.equal(meta.teacherSocketId,'teacher-live');
 assert.ok(!JSON.stringify(meta).includes('Hash'));assert.ok(!JSON.stringify(meta).includes(teacher));
 // Replacing the encrypted shared scene never replaces the protected layer.
 assert.equal((await request('/scenes/room?rev=2','PUT',{...scene,ciphertext:'student changes'},student)).status,200);
 assert.equal((await (await request('/workspaces/room','GET',undefined,student)).json()).protected.ciphertext,'teacher sheet');
 assert.equal((await (await request('/workspaces/room','GET',undefined,teacher)).json()).role,'teacher');
});
test('students can create immutable files, but cannot overwrite worksheet assets',async()=>{
 const u=base+'/files/files/rooms/room/asset';
 const put=(body,token)=>fetch(u,{method:'PUT',headers:{Authorization:`Bearer ${token}`},body});
 assert.equal((await put('original',teacher)).status,200);
 assert.equal((await put('tampered',student)).status,403);
 assert.equal((await put('original',student)).status,200);
 assert.equal(await (await fetch(u)).text(),'original');
 assert.equal((await fetch(u,{method:'PUT',body:'anonymous'})).status,403);
});
test('simultaneous writes use revision checks; encrypted history is retained',async()=>{
 const body={iv:'v',ciphertext:'encrypted',sceneVersion:1};
 const results=await Promise.all([request('/scenes/race?rev=0','PUT',body),request('/scenes/race?rev=0','PUT',body)]);
 assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
 await request('/scenes/race?rev=1','PUT',{...body,sceneVersion:2});
 const history=fs.readdirSync(path.join(dir,'history','race'));assert.equal(history.length,1);
 assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'history','race',history[0]))).ciphertext,'encrypted');
});
test('capabilities and STUN work without exposing persistent TURN secrets',async()=>{
 assert.equal((await (await request('/capabilities')).json()).workspace,1);
 const result=await (await request('/ice')).json();assert.equal(result.iceServers[0].urls,'stun:stun.cloudflare.com:3478');
});
