'use client';

import {useLayoutEffect, useRef} from 'react';
import SecurePhoto from './secure-photo';

export type ChatMessage = {id:string; sender_id:string; kind:string; body:string; created_at:number};
export type PendingPhoto = ChatMessage & {file:File; preview:string; delivery:'sending'|'failed'};
const groupGap = 5 * 60 * 1000;
const timestampGap = 30 * 60 * 1000;

function timestamp(time:number) {
  const date = new Date(time);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate()-1);
  const day = date.toDateString()===today.toDateString() ? 'Today' : date.toDateString()===yesterday.toDateString() ? 'Yesterday'
    : date.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric',...(date.getFullYear()!==today.getFullYear()?{year:'numeric'}:{})});
  return `${day} ${date.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})}`;
}

export default function ChatMessages({messages, userId, onRetryPhoto, previews, onPhotoReady}:{
  messages:(ChatMessage|PendingPhoto)[]; userId?:string; onRetryPhoto:(photo:PendingPhoto)=>void;
  previews:Record<string,string>; onPhotoReady:(id:string)=>void;
}) {
  const thread = useRef<HTMLDivElement>(null);
  const previous = useRef<Set<string>|null>(null);

  useLayoutEffect(() => {
    const known = previous.current;
    previous.current = new Set(messages.map(message=>message.id));
    if (!known || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    thread.current?.querySelectorAll<HTMLElement>('[data-message-id]').forEach(element=>{
      if (known.has(element.dataset.messageId!)) return;
      element.animate([
        {opacity:0,transform:'translateY(10px) scale(.92)'},
        {opacity:1,transform:'translateY(0) scale(1)'},
      ],{duration:260,easing:'cubic-bezier(.2,.75,.3,1)'});
    });
  },[messages]);

  return <div className="chat-messages" ref={thread}>{messages.map((message,index)=>{
    const before = messages[index-1];
    const after = messages[index+1];
    const showTime = !before || message.created_at-before.created_at>=timestampGap || new Date(message.created_at).toDateString()!==new Date(before.created_at).toDateString();
    const grouped = before?.sender_id===message.sender_id && message.created_at-before.created_at<groupGap && !showTime;
    const groupEnd = !after || after.sender_id!==message.sender_id || after.created_at-message.created_at>=groupGap || new Date(message.created_at).toDateString()!==new Date(after.created_at).toDateString();
    const photo = message.kind==='photo';
    const pending = 'delivery' in message ? message : null;
    return <div key={message.id} className={`chat-entry ${grouped?'grouped':''}`}>
      {showTime&&<time className="chat-time" dateTime={new Date(message.created_at).toISOString()}>{timestamp(message.created_at)}</time>}
      <article data-message-id={message.id} className={`chat-message ${message.sender_id===userId?'mine':''} ${groupEnd?'group-end':''} ${message.kind==='tap'?'love-tap':''}`}>
        {photo&&<div className="chat-photo">{pending?<img src={pending.preview} alt={message.body||'Your photo'}/>:<SecurePhoto id={message.id} alt={message.body||'A shared photo'} loading="lazy" preview={previews[message.id]} onReady={previews[message.id]?()=>onPhotoReady(message.id):undefined}/>}</div>}
        {message.body&&<p className="chat-bubble">{message.body}</p>}
        {pending?.delivery==='sending'&&<span className="chat-delivery" role="status">Sending…</span>}
        {pending?.delivery==='failed'&&<div className="chat-delivery failed"><span>Couldn’t send</span><button type="button" className="text-button" onClick={()=>onRetryPhoto(pending)}>Retry</button></div>}
      </article>
    </div>;
  })}</div>;
}
