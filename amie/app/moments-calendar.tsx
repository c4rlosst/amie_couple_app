'use client';

import {useEffect, useMemo, useState} from 'react';
import {Camera, ChevronLeft, ChevronRight} from 'lucide-react';
import {apiFetch} from '../lib/client-api';
import SecurePhoto from './secure-photo';
import type {ChatMessage} from './chat-messages';

type Moment = Pick<ChatMessage,'id'|'sender_id'|'body'|'created_at'>;
const weekdays = Array.from({length:7},(_,index)=>new Date(2024,0,7+index).toLocaleDateString(undefined,{weekday:'narrow'}));
const dateLabel = (date:Date) => date.toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric',year:'numeric'});

export default function MomentsCalendar({spaceId, recent, userId, partnerName}:{
  spaceId?:string; recent:Moment[]; userId?:string; partnerName?:string;
}) {
  const [selected,setSelected] = useState(()=>new Date());
  const [month,setMonth] = useState(()=>new Date(selected.getFullYear(),selected.getMonth(),1));
  const [result,setResult] = useState<{key:string; photos:Moment[]; error:boolean}>();
  const [retry,setRetry] = useState(0);
  const today = new Date();
  const from = month.getTime();
  const to = new Date(month.getFullYear(),month.getMonth()+1,1).getTime();
  const latestId = recent.at(-1)?.id ?? '';
  const requestKey = spaceId ? [spaceId,from,latestId,retry].join('/') : '';
  const monthName = month.toLocaleDateString(undefined,{month:'long',year:'numeric'});
  const currentMonth = month.getFullYear()===today.getFullYear() && month.getMonth()===today.getMonth();
  const active = result?.key===requestKey ? result : undefined;

  useEffect(()=>{
    if (!requestKey) return;
    const controller = new AbortController();
    void apiFetch(`/api/amie?momentsFrom=${from}&momentsTo=${to}`,{cache:'no-store',signal:controller.signal})
      .then(async response=>{
        if (!response.ok) throw new Error();
        const data = await response.json() as {photos?:Moment[]};
        if (!Array.isArray(data.photos)) throw new Error();
        if (!controller.signal.aborted) setResult({key:requestKey,photos:data.photos,error:false});
      }).catch(()=>{
        if (!controller.signal.aborted) setResult({key:requestKey,photos:[],error:true});
      });
    return ()=>controller.abort();
  },[requestKey,from,to]);

  const days = useMemo(()=>{
    const grouped = new Map<number,Moment[]>();
    const photos = new Map<string,Moment>();
    for(const photo of active?.photos ?? []) photos.set(photo.id,photo);
    for(const photo of recent) if(photo.created_at>=from && photo.created_at<to) photos.set(photo.id,photo);
    for(const photo of [...photos.values()].sort((a,b)=>b.created_at-a.created_at)){
      const day = new Date(photo.created_at).getDate();
      const items = grouped.get(day) ?? [];
      items.push(photo);
      grouped.set(day,items);
    }
    return grouped;
  },[active,recent,from,to]);
  const photos = days.get(selected.getDate()) ?? [];
  const count = new Date(month.getFullYear(),month.getMonth()+1,0).getDate();

  function moveMonth(offset:number){
    const next = new Date(month.getFullYear(),month.getMonth()+offset,1);
    setMonth(next);
    setSelected(next.getMonth()===today.getMonth() && next.getFullYear()===today.getFullYear() ? today : next);
  }

  return <div className="moment-calendar-layout">
    <section className="panel moment-calendar" aria-label="Photo calendar">
      <div className="moment-calendar-heading">
        <h2 aria-live="polite">{monthName}</h2>
        <div className="moment-calendar-navigation">
          <button className="icon-button" aria-label="Previous month" onClick={()=>moveMonth(-1)}><ChevronLeft size={20}/></button>
          <button className="icon-button" aria-label="Next month" disabled={currentMonth} onClick={()=>moveMonth(1)}><ChevronRight size={20}/></button>
        </div>
      </div>
      <div className="moment-calendar-grid">
        {weekdays.map((name,index)=><span className="moment-weekday" key={index} aria-hidden="true">{name}</span>)}
        {Array.from({length:month.getDay()},(_,index)=><span key={`blank-${index}`} aria-hidden="true"/>)}
        {Array.from({length:count},(_,index)=>{
          const day=index+1;
          const date=new Date(month.getFullYear(),month.getMonth(),day);
          const total=days.get(day)?.length ?? 0;
          const label=`${dateLabel(date)}, ${total} ${total===1?'photo':'photos'}`;
          return <button key={day} className="moment-date" aria-label={label} aria-pressed={day===selected.getDate()}
            aria-current={date.toDateString()===today.toDateString()?'date':undefined} disabled={date>today} onClick={()=>setSelected(date)}>
            <span>{day}</span>{total>0&&<span className="moment-date-dot" aria-hidden="true"/>}
          </button>;
        })}
      </div>
      <p className="moment-calendar-legend"><span aria-hidden="true"/> Days with photos</p>
    </section>
    <section className="moment-calendar-day" aria-label={dateLabel(selected)}>
      <div className="moment-day-heading">
        <div><h2>{selected.toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}</h2><p>{photos.length} {photos.length===1?'photo':'photos'}</p></div>
      </div>
      {requestKey&&!active&&<p role="status" className="moment-calendar-notice">Loading shared photos…</p>}
      {active?.error&&<div className="moment-calendar-notice" role="status">Earlier photos couldn’t load. <button className="text-button" onClick={()=>setRetry(value=>value+1)}>Retry</button></div>}
      {photos.length>0?<div className="moments-grid">{photos.map(photo=><article className="moment-card" key={photo.id}>
        <SecurePhoto id={photo.id} alt={photo.body||'A shared moment'} loading="lazy"/>
        <div>{photo.body&&<p>{photo.body}</p>}<span>{photo.sender_id===userId?'You':partnerName||'Your person'} · {new Date(photo.created_at).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})}</span></div>
      </article>)}</div>:(!requestKey||active&&!active.error)&&<div className="empty-state moments-empty"><Camera size={29}/><h3>No photos on this day</h3><p>Pick a marked date to see what you shared.</p></div>}
    </section>
  </div>;
}
