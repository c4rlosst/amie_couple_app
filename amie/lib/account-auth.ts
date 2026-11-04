export const PAGES_ORIGIN = 'https://c4rlosst.github.io';
type Env = { DB?: D1Database };
const encoder = new TextEncoder();
const hex = (bytes: ArrayBuffer | Uint8Array) => Array.from(new Uint8Array(bytes)).map(b=>b.toString(16).padStart(2,'0')).join('');
export async function digest(value: string) { return hex(await crypto.subtle.digest('SHA-256',encoder.encode(value))); }
async function passwordHash(password:string,salt:string) {
  const key = await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
  return hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:encoder.encode(salt),iterations:100000},key,256));
}
function equal(a:string,b:string) { let difference=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)difference|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return difference===0; }
export function allowedRequest(request:Request) { const origin=request.headers.get('origin');return !origin || origin===new URL(request.url).origin || origin===PAGES_ORIGIN; }
export function cors(request:Request,response:Response) {
  const headers=new Headers(response.headers);const origin=request.headers.get('origin');
  if(origin && allowedRequest(request))headers.set('Access-Control-Allow-Origin',origin);
  headers.set('Vary','Origin');headers.set('Cache-Control','no-store');headers.set('Access-Control-Allow-Methods','GET, POST, OPTIONS');headers.set('Access-Control-Allow-Headers','Authorization, Content-Type');
  return new Response(response.body,{status:response.status,headers});
}
export async function account(request:Request,env:Env) {
  const token=request.headers.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  if(!token||!env.DB)return null;
  return env.DB.prepare('SELECT a.id,a.name,a.username FROM accounts a JOIN sessions s ON s.account_id=a.id WHERE s.token_hash=? AND s.expires_at>?').bind(await digest(token),Date.now()).first<{id:string;name:string;username:string}>();
}
export async function authRoute(request:Request,env:Env):Promise<Response> {
  const reply=(data:unknown,status=200)=>cors(request,Response.json(data,{status}));
  if(!allowedRequest(request))return reply({error:'Use Amie directly to sign in.'},403);
  if(request.method==='OPTIONS')return cors(request,new Response(null,{status:204}));
  if(!env.DB)return reply({error:'Accounts are temporarily unavailable.'},503);
  try {
    if(request.method==='GET'){const user=await account(request,env);return user?reply({user}):reply({error:'Sign in to Amie.'},401);}
    const body=await request.json() as Record<string,unknown>;
    if(body.action==='logout'){
      const token=request.headers.get('authorization')?.replace(/^Bearer /,'');
      if(token)await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await digest(token)).run();
      return reply({ok:true});
    }
    if(body.action!=='login'&&body.action!=='register')return reply({error:'Choose sign in or create account.'},400);
    const username=typeof body.username==='string'?body.username.trim().toLowerCase():'';
    const password=typeof body.password==='string'?body.password:'';
    if(!/^[a-z0-9_]{3,32}$/.test(username)||password.length<12||password.length>128)return reply({error:'Use a username with 3–32 letters, numbers or underscores, and a password with 12–128 characters.'},400);
    const now=Date.now();const window=Math.floor(now/900000);
    const ipKey=await digest(`ip:${request.headers.get('cf-connecting-ip')||'unknown'}:${window}`);
    const ipAttempts=await env.DB.prepare('INSERT INTO auth_attempts (id,window,count) VALUES (?,?,1) ON CONFLICT(id) DO UPDATE SET count=count+1 RETURNING count').bind(ipKey,window).first<{count:number}>();
    if((ipAttempts?.count||0)>40)return reply({error:'Too many attempts from this connection. Try again in 15 minutes.'},429);
    const key=await digest(`${request.headers.get('cf-connecting-ip')||'unknown'}:${username}:${window}`);
    await env.DB.prepare('DELETE FROM auth_attempts WHERE window < ?').bind(window-96).run();
    const attempts=await env.DB.prepare('INSERT INTO auth_attempts (id,window,count) VALUES (?,?,1) ON CONFLICT(id) DO UPDATE SET count=count+1 RETURNING count').bind(key,window).first<{count:number}>();
    if((attempts?.count||0)>10)return reply({error:'Too many attempts. Try again in 15 minutes.'},429);
    let user=await env.DB.prepare('SELECT * FROM accounts WHERE username=?').bind(username).first<{id:string;username:string;name:string;salt:string;password_hash:string}>();
    if(body.action==='register'){
      if(user)return reply({error:'That username is already taken.'},409);
      const name=typeof body.name==='string'?body.name.trim().slice(0,40):'';
      if(!name)return reply({error:'Add your name.'},400);
      const salt=hex(crypto.getRandomValues(new Uint8Array(16)));const id=crypto.randomUUID();const hashed=await passwordHash(password,salt);
      await env.DB.prepare('INSERT INTO accounts (id,username,name,salt,password_hash,created_at) VALUES (?,?,?,?,?,?)').bind(id,username,name,salt,hashed,now).run();
      user={id,username,name,salt,password_hash:hashed};
    }else{
      const hashed=await passwordHash(password,user?.salt||'amie-invalid-account-dummy-salt');
      if(!user||!equal(hashed,user.password_hash))return reply({error:'Incorrect username or password.'},401);
    }
    const token=hex(crypto.getRandomValues(new Uint8Array(32)));
    await env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(now).run();
    await env.DB.prepare('INSERT INTO sessions (token_hash,account_id,expires_at) VALUES (?,?,?)').bind(await digest(token),user.id,now+30*86400000).run();
    return reply({token,user:{id:user.id,username:user.username,name:user.name}});
  }catch(error){console.error('Account request failed',error instanceof Error?error.message:'Unknown error');return reply({error:'Unable to complete sign-in. Please try again.'},500);}
}
