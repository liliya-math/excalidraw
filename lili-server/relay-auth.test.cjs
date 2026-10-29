const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {createPolicy}=require('./relay-auth');
test('relay blocks visitors, forged rooms and forged follow senders',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'lili-relay-test-'));fs.mkdirSync(path.join(dir,'workspaces'));
 try{
  const policy=createPolicy(dir),teacher='a'.repeat(64),student='b'.repeat(64),room='lesson';
  const socket=(token)=>({id:'self',data:{liliRoom:room},rooms:new Set([room]),handshake:{auth:{token}},nsp:{sockets:new Map()}});
  const visitor=socket();assert.equal(policy.broadcast(visitor,room),true);
  const digest=t=>crypto.createHash('sha256').update(t).digest('hex');
  fs.writeFileSync(path.join(dir,'workspaces',room+'.json'),JSON.stringify({teacherHash:digest(teacher),studentHash:digest(student)}));
  assert.equal(policy.broadcast(visitor,room),false); // A cached legacy room must not bypass a new claim.
  assert.equal(policy.broadcast(socket(teacher),room),true);assert.equal(policy.broadcast(socket(student),room),true);
  assert.equal(policy.broadcast(socket(student),'other-room'),false);assert.equal(policy.broadcast(socket(student),'follow@someone-else'),false);
  assert.equal(policy.broadcast(socket(student),'follow@self'),true);
  const pupil=socket(student);pupil.nsp.sockets.set('teacher',{rooms:new Set([room])});
  assert.equal(policy.follow(pupil,{userToFollow:{socketId:'teacher'}}),true);assert.equal(policy.follow(pupil,{userToFollow:{socketId:'outsider'}}),false);
  assert.equal(policy.join(pupil,'another-room'),false);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
