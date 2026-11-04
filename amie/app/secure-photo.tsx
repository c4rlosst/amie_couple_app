'use client';
import {useEffect,useState} from 'react';
import {apiFetch} from '../lib/client-api';
export default function SecurePhoto({id,alt,loading}:{id:string;alt:string;loading?:'lazy'|'eager'}){
  const [src,setSrc]=useState('');const [failed,setFailed]=useState(false);
  useEffect(()=>{let active=true;let url='';apiFetch(`/api/photos/${id}`).then(async res=>{if(!res.ok)throw new Error('Photo unavailable');const blob=await res.blob();if(!active)return;url=URL.createObjectURL(blob);setSrc(url);}).catch(()=>{if(active)setFailed(true);});return()=>{active=false;if(url)URL.revokeObjectURL(url);};},[id]);
  return src?<img src={src} alt={alt} loading={loading}/>:<span className="photo-loading" role="status">{failed?'Photo unavailable':'Loading photo…'}</span>;
}
