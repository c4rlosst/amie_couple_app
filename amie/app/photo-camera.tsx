'use client';

import {useEffect, useRef, useState} from 'react';
import {Camera, Images, LoaderCircle, RotateCcw, SwitchCamera} from 'lucide-react';

type Props = {photo:File|null; onPhoto:(photo:File|null)=>void; busy:boolean};
type Phase = 'starting'|'live'|'unavailable';

export default function PhotoCamera({photo,onPhoto,busy}:Props) {
  const videoRef=useRef<HTMLVideoElement>(null);
  const galleryRef=useRef<HTMLInputElement>(null);
  const cameraRef=useRef<HTMLInputElement>(null);
  const mounted=useRef(false);
  const [facing,setFacing]=useState<'environment'|'user'>('environment');
  const [actualFacing,setActualFacing]=useState('environment');
  const [phase,setPhase]=useState<Phase>('starting');
  const [retry,setRetry]=useState(0);
  const [visible,setVisible]=useState(true);
  const [capturing,setCapturing]=useState(false);
  const [error,setError]=useState('');
  const [cameraMessage,setCameraMessage]=useState('');
  const [preview,setPreview]=useState('');
  const disabled=busy||capturing;

  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  useEffect(()=>{
    if(!photo){setPreview('');return;}
    const url=URL.createObjectURL(photo);setPreview(url);
    return()=>URL.revokeObjectURL(url);
  },[photo]);
  useEffect(()=>{
    const change=()=>setVisible(document.visibilityState==='visible');
    const hide=()=>setVisible(false);
    change();document.addEventListener('visibilitychange',change);window.addEventListener('pagehide',hide);window.addEventListener('pageshow',change);
    return()=>{document.removeEventListener('visibilitychange',change);window.removeEventListener('pagehide',hide);window.removeEventListener('pageshow',change);};
  },[]);

  useEffect(()=>{
    if(photo||!visible)return;
    const video=videoRef.current;
    let disposed=false;
    let stream:MediaStream|null=null;
    const stop=()=>{
      stream?.getTracks().forEach(track=>track.stop());
      if(video?.srcObject===stream)video.srcObject=null;
    };
    const hide=()=>{if(document.visibilityState==='hidden')stop();};
    const open=async()=>{
      setPhase('starting');setCameraMessage('');
      try {
        if(!navigator.mediaDevices?.getUserMedia)throw new Error('unsupported');
        stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:facing},width:{ideal:1920},height:{ideal:1440}}});
        // Permission can resolve after the sheet closes or the app goes into the background.
        if(disposed||document.visibilityState==='hidden'){stop();return;}
        if(!video){stop();return;}
        setActualFacing(stream.getVideoTracks()[0]?.getSettings().facingMode||facing);
        video.srcObject=stream;
        await video.play();
        if(!disposed)setPhase('live');
      } catch(cause) {
        stop();
        if(disposed)return;
        setPhase('unavailable');
        setCameraMessage(cause instanceof DOMException&&cause.name==='NotAllowedError'
          ? 'Allow camera access to use the live preview, or take a photo with your phone’s camera.'
          : 'Use your phone’s camera, or open your photo library.');
      }
    };
    void open();
    document.addEventListener('visibilitychange',hide);window.addEventListener('pagehide',stop);
    return()=>{disposed=true;stop();document.removeEventListener('visibilitychange',hide);window.removeEventListener('pagehide',stop);};
  },[photo,facing,retry,visible]);

  function choose(file:File|undefined) {
    if(!file)return;
    if(file.type&&!file.type.startsWith('image/')){setError('Please select an image.');return;}
    if(file.size>25*1024*1024){setError('Choose a photo smaller than 25 MB.');return;}
    setError('');onPhoto(file);
  }

  async function capture() {
    const video=videoRef.current;
    if(!video?.videoWidth||!video.videoHeight){setError('The camera is still getting ready. Try again.');return;}
    setCapturing(true);setError('');
    try {
      // Match the visible frame so the reviewed photo has the same crop as the viewfinder.
      const ratio=video.clientWidth/video.clientHeight;
      const width=Math.min(video.videoWidth,video.videoHeight*ratio);
      const height=width/ratio;
      const scale=Math.min(1,1800/Math.max(width,height));
      const canvas=document.createElement('canvas');
      canvas.width=Math.round(width*scale);canvas.height=Math.round(height*scale);
      const context=canvas.getContext('2d');
      if(!context)throw new Error('Unable to take the photo. Please try again.');
      if(actualFacing==='user'){context.translate(canvas.width,0);context.scale(-1,1);}
      context.drawImage(video,(video.videoWidth-width)/2,(video.videoHeight-height)/2,width,height,0,0,canvas.width,canvas.height);
      const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('Unable to take the photo. Please try again.')),'image/jpeg',.9));
      if(mounted.current)onPhoto(new File([blob],`amie-${Date.now()}.jpg`,{type:'image/jpeg'}));
    } catch(cause) {
      if(mounted.current)setError(cause instanceof Error?cause.message:'Unable to take the photo. Please try again.');
    } finally {
      if(mounted.current)setCapturing(false);
    }
  }

  return <>
    <div className="photo-camera">
      {photo?<img className="camera-photo" src={preview||undefined} alt="Photo ready to share"/>:<video ref={videoRef} className={actualFacing==='user'?'camera-mirrored':''} autoPlay muted playsInline aria-label="Camera preview"/>}
      {!photo&&(!visible||phase!=='live')&&<div className="camera-placeholder" role="status">
        {phase==='starting'&&visible?<><LoaderCircle className="spin" size={28}/><p>Opening camera…</p></>:<><Camera size={32}/><p>{visible?cameraMessage:'Camera paused'}</p>{visible&&<button type="button" className="camera-retry" onClick={()=>setRetry(value=>value+1)} disabled={disabled}>Try live camera again</button>}</>}
      </div>}
      <div className="camera-controls">
        <button type="button" className="camera-tool camera-gallery" aria-label="Open photo library" title="Open photo library" disabled={disabled} onClick={()=>galleryRef.current?.click()}><Images size={24}/></button>
        {photo?<button type="button" className="camera-retake" onClick={()=>{setError('');onPhoto(null);}} disabled={disabled}><RotateCcw size={18}/>Retake</button>:<button type="button" className="camera-shutter" aria-label="Take photo" disabled={disabled||!visible||phase==='starting'} onClick={()=>phase==='live'?void capture():cameraRef.current?.click()}><span>{capturing?<LoaderCircle className="spin" size={26}/>:phase==='unavailable'?<Camera size={25}/>:null}</span></button>}
        {!photo&&phase==='live'?<button type="button" className="camera-tool" aria-label={`Switch to ${actualFacing==='user'?'back':'front'} camera`} disabled={disabled} onClick={()=>setFacing(actualFacing==='user'?'environment':'user')}><SwitchCamera size={24}/></button>:<span className="camera-control-spacer"/>}
      </div>
      <input ref={galleryRef} hidden type="file" accept="image/*" aria-label="Photo library" onChange={event=>{choose(event.target.files?.[0]);event.target.value='';}}/>
      <input ref={cameraRef} hidden type="file" accept="image/*" capture="environment" aria-label="Phone camera" onChange={event=>{choose(event.target.files?.[0]);event.target.value='';}}/>
    </div>
    {error&&<p className="camera-error" role="alert">{error}</p>}
  </>;
}
