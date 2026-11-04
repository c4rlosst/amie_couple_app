import { env } from 'cloudflare:workers';
import { account, allowedRequest, cors } from '../../../lib/account-auth';
import { handleAmie } from '../../../lib/service';

export const dynamic = 'force-dynamic';
async function handler(request: Request) {
  if(!allowedRequest(request))return cors(request,Response.json({error:'Origin not allowed.'},{status:403}));
  if(request.method==='OPTIONS')return cors(request,new Response(null,{status:204}));
  const user = await account(request,env);
  return cors(request,await handleAmie(request, env, user?.id ?? null, user?.name ?? 'You'));
}
export const GET = handler;
export const POST = handler;
export const OPTIONS = handler;
