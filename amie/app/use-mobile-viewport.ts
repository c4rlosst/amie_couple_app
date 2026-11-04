'use client';
import {useEffect} from 'react';

/** Keep dialogs and the conversation inside Safari's visible area when its keyboard opens. */
export function useMobileViewport(){
  useEffect(()=>{
    const root=document.documentElement;const viewport=window.visualViewport;
    let baseline=window.innerHeight;let width=window.innerWidth;
    const update=()=>{
      const height=Math.min(viewport?.height??window.innerHeight,window.innerHeight);
      if(Math.abs(window.innerWidth-width)>80){width=window.innerWidth;baseline=window.innerHeight;}
      root.style.setProperty('--visible-height',`${height}px`);
      root.style.setProperty('--visible-top',`${viewport?.offsetTop??0}px`);
      const focused=document.activeElement;
      const editing=focused instanceof HTMLInputElement||focused instanceof HTMLTextAreaElement;
      if(!editing)baseline=Math.max(baseline,window.innerHeight,height);
      root.dataset.keyboardOpen=String(editing&&Math.max(baseline-height,window.innerHeight-height)>100);
    };
    update();viewport?.addEventListener('resize',update);viewport?.addEventListener('scroll',update);window.addEventListener('resize',update);document.addEventListener('focusin',update);document.addEventListener('focusout',update);
    return()=>{viewport?.removeEventListener('resize',update);viewport?.removeEventListener('scroll',update);window.removeEventListener('resize',update);document.removeEventListener('focusin',update);document.removeEventListener('focusout',update);root.style.removeProperty('--visible-height');root.style.removeProperty('--visible-top');delete root.dataset.keyboardOpen;};
  },[]);
}
