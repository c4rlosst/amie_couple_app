import { allowedRequest } from './account-auth.ts';
type Bindings = { DB?: D1Database; BUCKET?: R2Bucket };
type Member = { id: string; space_id: string | null; name: string; mood: string; status: string; status_at: number; last_seen: number; latitude: number | null; longitude: number | null; accuracy: number | null; location_at: number | null; avatar_version:string|null };
class Problem extends Error { status: number; constructor(status: number, message: string) { super(message); this.status=status; } }
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: {'Cache-Control':'no-store'} });
function check(value: unknown, message: string): asserts value { if (!value) throw new Problem(400, message); }
async function hash(value: string) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))).map(x => x.toString(16).padStart(2,'0')).join(''); }
function inviteCode() { return Array.from(crypto.getRandomValues(new Uint8Array(10))).map(x => x.toString(16).padStart(2,'0')).join('').toUpperCase(); }
function text(value: unknown, max: number) { return typeof value === 'string' ? value.trim().slice(0,max) : ''; }
function database(env: Bindings) { if (!env.DB) throw new Problem(503, 'Shared storage is not connected yet. Please try again shortly.'); return env.DB; }
async function member(db: D1Database, uid: string) { return db.prepare('SELECT * FROM members WHERE id = ?').bind(uid).first<Member>(); }
async function requireMember(db: D1Database, uid: string) { const me = await member(db,uid); if (!me?.space_id) throw new Problem(403,'Create or join your space first.'); return me; }
function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!allowedRequest(request)) throw new Problem(403,'Please use Amie directly to make changes.');
}

export async function handleAmie(request: Request, env: Bindings, uid: string | null, displayName = 'You', onActivity?:(id:string,kind:'message'|'photo'|'tap')=>void, onLocationSaved?:()=>void): Promise<Response> {
  try {
    if (!uid) throw new Problem(401,'Sign in to open your private space.');
    const db = database(env); const now = Date.now();
    await db.prepare('INSERT INTO members (id,name,status_at,last_seen) VALUES (?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(uid,text(displayName,40)||'You',now,now).run();
    if (request.method === 'GET') {
      const me = (await member(db,uid))!;
      const params = new URL(request.url).searchParams;
      if (params.has('momentsFrom') || params.has('momentsTo')) {
        const from = Number(params.get('momentsFrom'));
        const to = Number(params.get('momentsTo'));
        check(Number.isSafeInteger(from) && Number.isSafeInteger(to) && from > 0 && to > from && to-from <= 32*86400000,'Choose a valid calendar month.');
        if (!me.space_id) return json({photos:[]});
        const photos = await db.prepare("SELECT id,sender_id,body,created_at FROM messages WHERE space_id = ? AND kind = 'photo' AND created_at >= ? AND created_at < ? ORDER BY created_at DESC,id DESC").bind(me.space_id,from,to).all();
        return json({photos:photos.results});
      }
      if (!me.space_id) return json({me,partner:null,space:null,messages:[]});
      const [partner,space,messages] = await Promise.all([
        db.prepare('SELECT * FROM members WHERE space_id = ? AND id != ?').bind(me.space_id,uid).first(),
        db.prepare('SELECT id,anniversary,created_at FROM spaces WHERE id = ?').bind(me.space_id).first(),
        db.prepare('SELECT id,sender_id,kind,body,created_at FROM (SELECT id,sender_id,kind,body,created_at FROM messages WHERE space_id = ? ORDER BY created_at DESC,id DESC LIMIT 200) ORDER BY created_at,id').bind(me.space_id).all(),
      ]);
      return json({me,partner,space,messages:messages.results});
    }
    sameOrigin(request);
    if (Number(request.headers.get('content-length')||0) > 9*1024*1024) throw new Problem(413,'Choose a photo smaller than 8 MB.');
    if (request.headers.get('content-type')?.includes('multipart/form-data')) {
      if (!env.BUCKET) throw new Problem(503,'Photo storage is not connected yet.');
      const form = await request.formData(); const file = form.get('photo');
      const avatar = form.get('purpose') === 'avatar';
      const me = avatar ? (await member(db,uid))! : await requireMember(db,uid);
      check(file instanceof File && file.size > 0 && file.size <= 8*1024*1024,'Choose a photo smaller than 8 MB.');
      const photo = file as File; const bytes = new Uint8Array(await photo.arrayBuffer());
      const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
      const png = [137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b);
      check(jpeg || png,'Please choose a JPEG or PNG photo.');
      if(avatar){
        const version=crypto.randomUUID();const key=`avatars/${uid}/${version}`;
        await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:jpeg?'image/jpeg':'image/png'}});
        try {
          const changed=await db.prepare('UPDATE members SET avatar_version=? WHERE id=? AND avatar_version IS ?').bind(version,uid,me.avatar_version).run();
          check(changed.meta.changes===1,'Your profile changed. Please try again.');
        } catch(error){await env.BUCKET.delete(key);throw error;}
        if(me.avatar_version)await env.BUCKET.delete(`avatars/${uid}/${me.avatar_version}`).catch(()=>console.warn('Old profile photo cleanup deferred'));
        return json({ok:true});
      }
      const id = crypto.randomUUID(); const key = `${me.space_id}/${id}`; const mime = jpeg ? 'image/jpeg' : 'image/png';
      await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:mime}});
      try { await db.prepare('INSERT INTO messages (id,space_id,sender_id,kind,body,file_key,mime,created_at) VALUES (?,?,?,?,?,?,?,?)').bind(id,me.space_id,uid,'photo',text(form.get('caption'),1000),key,mime,now).run(); }
      catch(error) { await env.BUCKET.delete(key); throw error; }
      onActivity?.(id,'photo');
      return json({ok:true,id});
    }
    const body = await request.json() as Record<string,unknown>;
    const action = body.action;
    if(action==='remove-avatar'){
      const me=(await member(db,uid))!;
      await db.prepare('UPDATE members SET avatar_version=NULL WHERE id=? AND avatar_version IS ?').bind(uid,me.avatar_version).run();
      if(me.avatar_version&&env.BUCKET)await env.BUCKET.delete(`avatars/${uid}/${me.avatar_version}`).catch(()=>console.warn('Old profile photo cleanup deferred'));
      return json({ok:true});
    }
    if (action === 'create') {
      const me = (await member(db,uid))!;
      check(!me.space_id,'You already have a space.'); const name = text(body.name,40); check(name,'Add your name first.');
      const code = inviteCode(); const id = crypto.randomUUID();
      await db.batch([
        db.prepare('INSERT INTO spaces (id,owner_id,invite_hash,invite_expires,created_at) SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM members WHERE id = ? AND space_id IS NULL)').bind(id,uid,await hash(code),now+86400000,now,uid),
        db.prepare('UPDATE members SET space_id = ?,name = ? WHERE id = ? AND space_id IS NULL AND EXISTS (SELECT 1 FROM spaces WHERE id = ?)').bind(id,name,uid,id),
      ]);
      check((await member(db,uid))?.space_id === id,'Your space was already created. Refresh to open it.');
      return json({ok:true,code});
    }
    if (action === 'join') {
      const me = (await member(db,uid))!; check(!me.space_id,'You already have a space.');
      const name = text(body.name,40); const code = text(body.code,60).replace(/[\s-]/g,'').toUpperCase();
      check(name && /^[A-F0-9]{20}$/.test(code),'Add your name and the full invite code.');
      const digest = await hash(code);
      await db.batch([
        db.prepare('UPDATE spaces SET partner_id = ? WHERE invite_hash = ? AND invite_expires > ? AND partner_id IS NULL AND owner_id != ? AND EXISTS (SELECT 1 FROM members WHERE id = ? AND space_id IS NULL)').bind(uid,digest,now,uid,uid),
        db.prepare('UPDATE members SET space_id = (SELECT id FROM spaces WHERE invite_hash = ? AND partner_id = ?),name = ? WHERE id = ? AND space_id IS NULL AND EXISTS (SELECT 1 FROM spaces WHERE invite_hash = ? AND partner_id = ?)').bind(digest,uid,name,uid,digest,uid),
        db.prepare('UPDATE spaces SET invite_hash = NULL,invite_expires = NULL WHERE invite_hash = ? AND partner_id = ?').bind(digest,uid),
      ]);
      check((await member(db,uid))?.space_id,'This invite has expired or was already used. Ask for a new one.');
      return json({ok:true});
    }
    const me = await requireMember(db,uid);
    if (action === 'invite') {
      const code = inviteCode();
      const result = await db.prepare('UPDATE spaces SET invite_hash = ?,invite_expires = ? WHERE id = ? AND owner_id = ? AND partner_id IS NULL').bind(await hash(code),now+86400000,me.space_id,uid).run();
      check(result.meta.changes,'Your space already has a partner.'); return json({ok:true,code});
    }
    if (action === 'profile') {
      const name = text(body.name,40); check(name,'Your name cannot be empty.');
      await db.prepare('UPDATE members SET name = ? WHERE id = ?').bind(name,uid).run();
    } else if (action === 'checkin') {
      const moods = ['happy','loved','okay','tired','low']; const statuses = ['around','busy','sleeping'];
      const mood = body.mood ?? me.mood; const status = body.status ?? me.status;
      check(moods.includes(String(mood)) && statuses.includes(String(status)),'Choose one of the listed moods and statuses.');
      await db.prepare('UPDATE members SET mood = ?,status = ?,status_at = ?,last_seen = ? WHERE id = ?').bind(mood,status,now,now,uid).run();
    } else if (action === 'heartbeat') {
      await db.prepare('UPDATE members SET last_seen = ? WHERE id = ?').bind(now,uid).run();
    } else if (action === 'location') {
      const {latitude,longitude,accuracy} = body;
      check(typeof latitude==='number' && Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 && typeof longitude==='number' && Number.isFinite(longitude) && longitude >= -180 && longitude <=180 && typeof accuracy==='number' && Number.isFinite(accuracy) && accuracy>=0,'The location could not be read. Please try again.');
      await db.prepare('UPDATE members SET latitude = ?,longitude = ?,accuracy = ?,location_at = ? WHERE id = ?').bind(latitude,longitude,accuracy,now,uid).run();
      onLocationSaved?.();
    } else if (action === 'stop-location') {
      await db.prepare('UPDATE members SET latitude = NULL,longitude = NULL,accuracy = NULL,location_at = NULL WHERE id = ?').bind(uid).run();
    } else if (action === 'anniversary') {
      const date = text(body.date,10);
      check(/^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0,10) === date && date <= new Date().toISOString().slice(0,10),'Choose a valid date in the past or today.');
      await db.prepare('UPDATE spaces SET anniversary = ? WHERE id = ?').bind(date,me.space_id).run();
    } else if (action === 'message' || action === 'tap') {
      const message = action==='tap' ? 'Thinking of you ♡' : text(body.body,4000); check(message,'Write a message first.');
      const id = text(body.id,50); check(/^[\da-f-]{36}$/.test(id),'Please retry sending this message.');
      const inserted=await db.prepare('INSERT INTO messages (id,space_id,sender_id,kind,body,created_at) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(id,me.space_id,uid,action==='tap'?'tap':'text',message,now).run();
      if(inserted.meta.changes)onActivity?.(id,action==='tap'?'tap':'message');
    } else throw new Problem(400,'This action is not available.');
    return json({ok:true});
  } catch(error) {
    if (error instanceof Problem) return json({error:error.message},error.status);
    if (error instanceof SyntaxError) return json({error:'This request could not be read.'},400);
    console.error('Amie request failed',error instanceof Error ? error.message : 'Unknown error');
    return json({error:'We couldn’t save that. Check your connection and try again.'},500);
  }
}

export async function getPhoto(env: Bindings, uid: string | null, id: string): Promise<Response> {
  if (!uid) return json({error:'Sign in to view this photo.'},401);
  const db = database(env);
  const row = await db.prepare('SELECT m.file_key,m.mime FROM messages m JOIN members u ON u.space_id = m.space_id WHERE m.id = ? AND u.id = ? AND m.kind = ?').bind(id,uid,'photo').first<{file_key:string;mime:string}>();
  if (!row || !env.BUCKET) return new Response('Photo not found',{status:404});
  const file = await env.BUCKET.get(row.file_key);
  if (!file) return new Response('Photo not found',{status:404});
  return new Response(file.body,{headers:{'Content-Type':row.mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});
}

export async function getAvatar(env:Bindings,uid:string|null,id:string):Promise<Response>{
  if(!uid)return json({error:'Sign in to view this profile photo.'},401);
  const row=await database(env).prepare('SELECT target.avatar_version FROM members target JOIN members viewer ON viewer.id=? WHERE target.id=? AND (target.id=viewer.id OR (target.space_id IS NOT NULL AND target.space_id=viewer.space_id))').bind(uid,id).first<{avatar_version:string|null}>();
  if(!row?.avatar_version||!env.BUCKET)return new Response('Photo not found',{status:404});
  const file=await env.BUCKET.get(`avatars/${id}/${row.avatar_version}`);
  if(!file)return new Response('Photo not found',{status:404});
  return new Response(file.body,{headers:{'Content-Type':file.httpMetadata?.contentType||'image/jpeg','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});
}
