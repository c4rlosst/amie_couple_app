import { account, allowedRequest, authRoute, cors } from '../lib/account-auth.ts';
import { getPhoto, getAvatar, handleAmie } from '../lib/service.ts';

export type BackendEnv = { DB?: D1Database; BUCKET?: R2Bucket };

async function boundedJson(request: Request): Promise<Request | null> {
  if (!request.body) return request;
  const reader=request.body.getReader(); const chunks:Uint8Array[]=[];let size=0;
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>16384){await reader.cancel();return null;}chunks.push(value);}
  const body=new Uint8Array(size);let offset=0;for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.byteLength;}
  return new Request(request,{body});
}

export async function handleBackend(request:Request,env:BackendEnv):Promise<Response>{
  const reply=(body:unknown,status=200)=>cors(request,Response.json(body,{status}));
  const path=new URL(request.url).pathname;
  if(!allowedRequest(request))return reply({error:'Origin not allowed.'},403);
  if(request.method==='OPTIONS')return cors(request,new Response(null,{status:204}));
  if(request.method==='GET'&&path==='/health')return reply({ok:true,service:'amie-api',database:!!env.DB,photos:!!env.BUCKET});
  if(!['GET','POST'].includes(request.method))return reply({error:'Method not allowed.'},405);
  try{
    if(request.method==='POST'&&!request.headers.get('content-type')?.includes('multipart/form-data')){
      const limited=await boundedJson(request);if(!limited)return reply({error:'This request is too large.'},413);request=limited;
    }
    if(path==='/api/auth')return authRoute(request,env);
    if(path!=='/api/amie'&&!/^\/api\/(photos|avatars)\/[a-f0-9-]{36}$/.test(path))return reply({error:'Not found.'},404);
    if(request.method!=='GET'&&/^\/api\/(photos|avatars)\//.test(path))return reply({error:'Method not allowed.'},405);
    if(!env.DB)return reply({error:'The database is unavailable. Please try again shortly.'},503);
    const user=await account(request,env);
    if(path==='/api/amie')return cors(request,await handleAmie(request,env,user?.id??null,user?.name??'You'));
    if(path.startsWith('/api/avatars/'))return cors(request,await getAvatar(env,user?.id??null,path.slice('/api/avatars/'.length)));
    return cors(request,await getPhoto(env,user?.id??null,path.slice('/api/photos/'.length)));
  }catch(error){console.error('Amie API failed',error instanceof Error?error.message:'Unknown error');return reply({error:'The service is temporarily unavailable. Please try again.'},500);}
}

export default {fetch:handleBackend};
