'use client';
import {useEffect,useRef,useState} from 'react';
import {Camera,LoaderCircle} from 'lucide-react';
import Avatar from './profile-avatar';
import {apiFetch} from '../lib/client-api';

export default function ProfilePhotoEditor({member,onSaved}:{member:{id:string;name:string;avatar_version:string|null};onSaved:(message:string)=>Promise<void>}){
  const input=useRef<HTMLInputElement>(null);
  const [photo,setPhoto]=useState<File|null>(null);const [preview,setPreview]=useState('');
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  useEffect(()=>{if(!photo){setPreview('');return;}const url=URL.createObjectURL(photo);setPreview(url);return()=>URL.revokeObjectURL(url);},[photo]);
  async function select(file:File|undefined){
    if(!file)return;setError('');
    if(file.size>25*1024*1024){setError('Choose a photo smaller than 25 MB.');return;}
    setBusy(true);
    try {
      const image=await createImageBitmap(file);const side=Math.min(image.width,image.height);
      const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;
      const context=canvas.getContext('2d');if(!context){image.close();throw new Error('Unable to prepare this photo.');}
      context.fillStyle='#fff';context.fillRect(0,0,512,512);
      context.drawImage(image,(image.width-side)/2,(image.height-side)/2,side,side,0,0,512,512);image.close();
      const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('Unable to prepare this photo.')),'image/jpeg',.9));
      setPhoto(new File([blob],'profile.jpg',{type:'image/jpeg'}));
    }catch{setError('This photo could not be opened. Try a JPEG or PNG image.');}finally{setBusy(false);}
  }
  async function save(remove=false){
    setBusy(true);setError('');
    try {
      const form=new FormData();if(photo)form.set('photo',photo,'profile.jpg');form.set('purpose','avatar');
      const response=await apiFetch('/api/amie',remove?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'remove-avatar'})}:{method:'POST',body:form});
      const result=await response.json() as {error?:string};if(!response.ok)throw new Error(result.error||'Unable to save your photo.');
      setPhoto(null);await onSaved(remove?'Your profile photo was removed.':'Your profile photo was updated.');
    }catch(cause){setError(cause instanceof Error?cause.message:'Unable to save your photo.');}finally{setBusy(false);}
  }
  return <div className="profile-photo-setting">
    <div className="profile-photo-row">
      {preview?<div className="avatar profile-photo-preview"><img src={preview} alt="Your new profile photo"/></div>:<Avatar name={member.name} id={member.id} version={member.avatar_version}/>}
      <div><h3>Your profile photo</h3><p>Visible to your person.</p><button type="button" className="text-button" disabled={busy} onClick={()=>input.current?.click()}>{busy?<LoaderCircle size={16} className="spin"/>:<Camera size={16}/>} {photo?'Choose another':member.avatar_version?'Change photo':'Add photo'}</button></div>
    </div>
    <input ref={input} hidden type="file" accept="image/*" aria-label="Your profile photo" onChange={event=>{void select(event.target.files?.[0]);event.target.value='';}}/>
    {photo?<div className="profile-photo-actions"><button type="button" className="button primary" disabled={busy} onClick={()=>void save()}>Save photo</button><button type="button" className="text-button" disabled={busy} onClick={()=>{setPhoto(null);setError('');}}>Cancel</button></div>:member.avatar_version&&<button type="button" className="text-button profile-photo-remove" disabled={busy} onClick={()=>void save(true)}>Remove photo</button>}
    {error&&<p className="camera-error" role="alert">{error}</p>}
  </div>;
}
