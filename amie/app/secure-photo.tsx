'use client';
import {useEffect,useState} from 'react';
import {apiFetch} from '../lib/client-api';

export default function SecurePhoto({id,alt,loading,preview,onReady}:{id:string;alt:string;loading?:'lazy'|'eager';preview?:string;onReady?:()=>void}){
  const [result,setResult]=useState<{id:string;src:string|null}>();
  useEffect(()=>{
    const controller=new AbortController();
    let url='';
    void apiFetch(`/api/photos/${id}`,{signal:controller.signal}).then(async response=>{
      if(!response.ok)throw new Error('Photo unavailable');
      const blob=await response.blob();
      if(controller.signal.aborted)return;
      url=URL.createObjectURL(blob);
      const image=new Image();
      image.src=url;
      await image.decode();
      if(!controller.signal.aborted)setResult({id,src:url});
    }).catch(()=>{
      if(!controller.signal.aborted)setResult({id,src:null});
    });
    return()=>{controller.abort();if(url)URL.revokeObjectURL(url);};
  },[id]);

  const src=result?.id===id?result.src:undefined;
  if(!src&&preview)return <img src={preview} alt={alt}/>;
  if(src===undefined)return <span className="photo-skeleton" role="status" aria-label="Loading photo"/>;
  if(src===null)return <span className="photo-loading" role="status">Photo unavailable</span>;
  return <img src={src} alt={alt} loading={loading} onLoad={onReady} onError={()=>setResult({id,src:null})}/>;
}
