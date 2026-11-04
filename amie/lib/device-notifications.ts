import {apiFetch,assetUrl} from './client-api';

export async function pushRequest(body:Record<string,unknown>){
  const response=await apiFetch('/api/push',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const result=await response.json() as {error?:string;enabled?:boolean};
  if(!response.ok)throw new Error(result.error||'Unable to update notifications.');return result;
}
export async function disableDeviceNotifications(){
  if(!('serviceWorker' in navigator))return;
  const registration=await navigator.serviceWorker.getRegistration(assetUrl(''));
  const subscription=await registration?.pushManager?.getSubscription();if(!subscription)return;
  try{await pushRequest({action:'unsubscribe',endpoint:subscription.endpoint});}
  finally{await subscription.unsubscribe();}
}
