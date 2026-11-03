import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../chatgpt-auth';
import { handleAmie } from '../../../lib/service';

export const dynamic = 'force-dynamic';
async function handler(request: Request) {
  const user = await getChatGPTUser();
  return handleAmie(request, env, user?.userId ?? null, user?.fullName ?? 'You');
}
export const GET = handler;
export const POST = handler;
