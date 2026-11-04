import { env } from 'cloudflare:workers';
import { account, allowedRequest, cors } from '../../../../lib/account-auth';
import { getPhoto } from '../../../../lib/service';
export const dynamic = 'force-dynamic';
export async function GET(request: Request, context: { params: Promise<{id: string}> }) {
  if(!allowedRequest(request))return cors(request,new Response('Origin not allowed',{status:403}));
  const user = await account(request,env);
  const { id } = await context.params;
  return cors(request,await getPhoto(env, user?.id ?? null, id));
}
export const OPTIONS=(request:Request)=>cors(request,new Response(null,{status:allowedRequest(request)?204:403}));
