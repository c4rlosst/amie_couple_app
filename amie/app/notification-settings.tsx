'use client';
import {useEffect,useState} from 'react';
import {Bell,LoaderCircle} from 'lucide-react';
import {apiFetch,assetUrl} from '../lib/client-api';
import {disableDeviceNotifications,PushRequestError,pushRequest} from '../lib/device-notifications';

function publicKey(value:string){return Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));}
export default function NotificationSettings(){
  const [registration,setRegistration]=useState<ServiceWorkerRegistration|null>(null);
  const [key,setKey]=useState('');const [enabled,setEnabled]=useState(false);const [busy,setBusy]=useState(true);
  const [error,setError]=useState('');const [notice,setNotice]=useState('');const [hint,setHint]=useState('');
  useEffect(()=>{
    let active=true;
    async function load(){
      const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
      const standalone=window.matchMedia('(display-mode: standalone)').matches||(navigator as Navigator&{standalone?:boolean}).standalone;
      if(ios&&!standalone){setHint('On iPhone, add Amie to your Home Screen in Safari, then open it from that icon to enable notifications.');return;}
      if(!('Notification' in window)||!('PushManager' in window)||!('serviceWorker' in navigator)){setHint('Push notifications aren’t supported in this browser. Try Amie from your iPhone Home Screen.');return;}
      if(Notification.permission==='denied'){setHint('Notifications are blocked. Allow them for Amie in your device’s notification settings, then reopen Amie.');return;}
      const response=await apiFetch('/api/push');const config=await response.json() as {configured?:boolean;publicKey?:string;error?:string};
      if(!response.ok)throw new Error(config.error||'Unable to load notification settings.');
      if(!config.configured||!config.publicKey){setHint('Notifications are being set up. Please try again shortly.');return;}
      await navigator.serviceWorker.register(assetUrl('sw.js'));
      const ready=await navigator.serviceWorker.ready;if(!active)return;
      const subscription=await ready.pushManager.getSubscription();
      const status=subscription?await pushRequest({action:'status',endpoint:subscription.endpoint}):{enabled:false};
      if(active){setRegistration(ready);setKey(config.publicKey);setEnabled(!!status.enabled);}
    }
    void load().catch(cause=>{if(active)setError(cause instanceof Error?cause.message:'Unable to load notifications.');}).finally(()=>{if(active)setBusy(false);});
    return()=>{active=false;};
  },[]);
  async function enable(){
    if(!registration||!key)return;
    setBusy(true);setError('');setNotice('');
    let subscription:PushSubscription|null=null;
    try{
      // The browser permission/subscription call stays directly inside the tap handler for iPhone.
      subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:publicKey(key)});
      const data=subscription.toJSON();
      await pushRequest({action:'subscribe',endpoint:subscription.endpoint,keys:data.keys});
      setEnabled(true);setNotice('Notifications are on for this device.');
    }catch(cause){
      if((cause instanceof DOMException&&cause.name==='InvalidStateError')||(cause instanceof PushRequestError&&cause.status===409)){
        const stale=subscription||await registration.pushManager.getSubscription().catch(()=>null);
        if(stale&&await stale.unsubscribe().catch(()=>false)){
          setError('The old notification connection was removed. Tap Enable notifications again.');
          return;
        }
      }
      setError(Notification.permission==='denied'?'Notifications were blocked. Allow them in your device settings to try again.':cause instanceof Error?cause.message:'Unable to enable notifications.');
    }finally{setBusy(false);}
  }
  async function disable(){setBusy(true);setError('');setNotice('');try{await disableDeviceNotifications();setEnabled(false);setNotice('Notifications are off for this device.');}catch{setEnabled(false);setError('Device notifications were stopped. Server cleanup will retry when the subscription expires.');}finally{setBusy(false);}}
  async function test(){
    setBusy(true);setError('');setNotice('');
    try{
      const sub=await registration?.pushManager.getSubscription();
      if(!sub){setEnabled(false);throw new Error('Enable notifications again first.');}
      await pushRequest({action:'test',endpoint:sub.endpoint});
      setNotice('Test accepted. Check Notification Center. If it’s missing, check your device’s notification and Focus settings.');
    }catch(cause){
      if(cause instanceof PushRequestError&&(cause.status===404||cause.status===410))setEnabled(false);
      setError(cause instanceof Error?cause.message:'Unable to send a test.');
    }finally{setBusy(false);}
  }
  return <section className="notification-setting" aria-labelledby="notification-heading">
    <div className="notification-title"><Bell size={20}/><h3 id="notification-heading">Notifications</h3>{busy&&<LoaderCircle className="spin" size={16}/>}</div>
    <p>Messages, photos, little love taps, and nearby alerts when you both share a recent location. Text messages appear in notification previews.</p>
    {hint?<p className="notification-hint">{hint}</p>:registration&&<><p className="notification-state">{enabled?'On for this device':'Off for this device'}</p><div className="notification-actions">{enabled?<><button type="button" className="button secondary" disabled={busy} onClick={()=>void test()}>Send test</button><button type="button" className="text-button" disabled={busy} onClick={()=>void disable()}>Turn off</button></>:<button type="button" className="button secondary" disabled={busy} onClick={()=>void enable()}>Enable notifications</button>}</div></>}
    {notice&&<p className="notification-feedback" role="status">{notice}</p>}{error&&<p className="camera-error" role="alert">{error}</p>}
  </section>;
}
