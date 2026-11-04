'use client';
import {useEffect,useState} from 'react';
import {apiFetch} from '../lib/client-api';

export default function Avatar({name,id,version,partner=false,small=false}:{name:string;id?:string;version?:string|null;partner?:boolean;small?:boolean}){
  const key=id&&version?`${id}/${version}`:'';
  const [image,setImage]=useState({key:'',src:''});
  useEffect(()=>{
    if(!key)return;
    let active=true;let url='';
    apiFetch(`/api/avatars/${id}?v=${version}`).then(async response=>{
      if(!response.ok)return;
      const blob=await response.blob();if(!active)return;
      url=URL.createObjectURL(blob);setImage({key,src:url});
    }).catch(()=>{});
    return()=>{active=false;if(url)URL.revokeObjectURL(url);};
  },[key,id,version]);
  return <div className={`avatar ${partner?'partner':''} ${small?'small':''}`} role="img" aria-label={name}>{key&&image.key===key?<img src={image.src} alt=""/>:name.trim().split(/\s+/).slice(0,2).map(word=>word[0]).join('').toUpperCase()}</div>;
}
