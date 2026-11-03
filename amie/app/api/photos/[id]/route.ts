import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../../chatgpt-auth';
import { getPhoto } from '../../../../lib/service';
export const dynamic = 'force-dynamic';
export async function GET(request: Request, context: { params: Promise<{id: string}> }) {
  const user = await getChatGPTUser();
  const { id } = await context.params;
  return getPhoto(env, user?.userId ?? null, id);
}
