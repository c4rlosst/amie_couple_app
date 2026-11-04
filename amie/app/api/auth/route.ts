import { env } from 'cloudflare:workers';
import { authRoute } from '../../../lib/account-auth';
export const dynamic='force-dynamic';
export const GET=(request:Request)=>authRoute(request,env);
export const POST=GET;
export const OPTIONS=GET;
