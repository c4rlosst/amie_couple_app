'use client';
import {useEffect,useRef,useState} from 'react';
import type {Map as LeafletMap,Marker,Circle} from 'leaflet';
import {Info,Navigation,LoaderCircle,MapPin} from 'lucide-react';
import {mapLongitude,type MapPoint} from '../lib/location';
import 'leaflet/dist/leaflet.css';

export default function SharedMap({points,focusRequest}:{points:MapPoint[];focusRequest?:{id:string;version:number}|null}){
  const container=useRef<HTMLDivElement>(null);const map=useRef<LeafletMap|null>(null);
  const latest=useRef(points);latest.current=points;
  const update=useRef<((points:MapPoint[],fit?:boolean,focusId?:string)=>void)|null>(null);
  const [info,setInfo]=useState(false);
  const [ready,setReady]=useState(false);const [error,setError]=useState('');const [tilesFailed,setTilesFailed]=useState(false);
  useEffect(()=>{
    let disposed=false;let observer:ResizeObserver|undefined;
    void import('leaflet').then(L=>{
      if(disposed||!container.current)return;
      const instance=L.map(container.current,{zoomControl:false,scrollWheelZoom:false,attributionControl:false,worldCopyJump:true});map.current=instance;
      L.control.zoom({position:'topright'}).addTo(instance);
      L.control.attribution({position:'topleft',prefix:false}).addTo(instance);
      const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,keepBuffer:1,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'}).addTo(instance);
      tiles.on('tileerror',()=>{if(!disposed)setTilesFailed(true);});tiles.on('tileload',()=>{if(!disposed)setTilesFailed(false);});
      const layers=L.layerGroup().addTo(instance);let signature='';let fitted=false;
      const pins=new Map<string,{marker:Marker;circle:Circle;label:string}>();
      update.current=(current,fit=false,focusId)=>{
        if(focusId&&!current.some(point=>point.id===focusId))focusId=undefined;
        const ids=current.map(p=>p.id).join(':');const anchor=current[0]?.longitude??0;
        for(const [id,pin] of pins)if(!current.some(point=>point.id===id)){layers.removeLayer(pin.marker);layers.removeLayer(pin.circle);pins.delete(id);}
        const bounds=L.latLngBounds([]);
        for(const point of current){
          const position=L.latLng(point.latitude,mapLongitude(point.longitude,anchor));const color=point.own?'#006de5':'#7354b5';
          const label=point.name;let pin=pins.get(point.id);
          if(!pin||pin.label!==label){
            if(pin){layers.removeLayer(pin.marker);layers.removeLayer(pin.circle);}
            const element=document.createElement('div');element.className=`map-person-pin ${point.own?'own':'partner'}`;
            const initials=document.createElement('span');initials.textContent=label.trim().split(/\s+/).slice(0,2).map(word=>word[0]).join('').toUpperCase();element.appendChild(initials);
            const tooltip=document.createElement('span');tooltip.textContent=label;
            const marker=L.marker(position,{icon:L.divIcon({className:'map-person-marker',html:element,iconSize:point.own?[24,24]:[38,38],iconAnchor:point.own?[12,12]:[19,19]}),title:label,alt:`${label}'s last shared location`}).bindTooltip(tooltip.innerHTML,{permanent:true,direction:'top',offset:[0,point.own?-18:-24],className:'map-person-label'}).addTo(layers);
            const circle=L.circle(position,{radius:Math.min(20000000,Math.max(1,point.accuracy??0)),color,fillColor:color,fillOpacity:.08,weight:1,interactive:false}).addTo(layers);
            marker.getElement()?.setAttribute('aria-label',`${label}'s last shared location`);
            pin={marker,circle,label};pins.set(point.id,pin);
          }
          pin.marker.setLatLng(position);pin.circle.setLatLng(position).setRadius(Math.min(20000000,Math.max(1,point.accuracy??0))).setStyle({opacity:point.accuracy===null?0:1,fillOpacity:point.accuracy===null?0:.08});if(!focusId||point.id===focusId)bounds.extend(position);
        }
        if(current.length&&(fit||!fitted||signature!==ids)){instance.fitBounds(bounds,{paddingTopLeft:[48,140],paddingBottomRight:[48,Math.max(48,Math.min((container.current?.closest('.location-full')?.querySelector('.location-sheet')?.getBoundingClientRect().height??0)+40,instance.getSize().y-180))],maxZoom:current.some(point=>(point.accuracy??0)>500)?12:15,animate:false});fitted=true;}
        if(!current.length){instance.setView([20,0],2);fitted=false;}
        signature=ids;
      };
      update.current(latest.current,true);
      observer=new ResizeObserver(()=>instance.invalidateSize({pan:false}));observer.observe(container.current);
      setReady(true);
    }).catch(()=>{if(!disposed)setError('The map could not load. Please reopen this page to try again.');});
    return()=>{disposed=true;observer?.disconnect();map.current?.remove();map.current=null;update.current=null;};
  },[]);
  useEffect(()=>{update.current?.(points);},[points]);
  useEffect(()=>{if(ready&&focusRequest)update.current?.(latest.current,true,focusRequest.id==='all'?undefined:focusRequest.id);},[focusRequest,ready]);
  return <div className="shared-map-wrap">
    <div ref={container} className="shared-map" role="region" aria-label="Map of your last shared locations"/>
    {!ready&&!error&&<div className="map-loading" role="status"><LoaderCircle size={22} className="spin"/>Loading map…</div>}
    {error&&<div className="map-loading" role="alert"><MapPin size={24}/>{error}</div>}
    {ready&&<><button type="button" className="map-info-button" aria-label="Map information" aria-expanded={info} onClick={()=>setInfo(value=>!value)}><Info size={23}/></button><button type="button" className="map-fit" onClick={()=>update.current?.(latest.current,true,latest.current.find(point=>point.own)?.id)} aria-label="Center on your saved location"><Navigation size={22}/></button><div className="map-compass" role="img" aria-label="Map is north up"><span>N</span><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="m12 2 5 10H7Z" fill="#ff625d"/><path d="m12 22 5-10H7Z" fill="#aaaab0"/></svg></div></>}
    {info&&<div className="map-information" role="status">Pins show last shared locations. Circles show GPS accuracy. North is always up. Map tiles: OpenStreetMap.</div>}
    {tilesFailed&&<div className="map-tile-error" role="status">Map tiles are unavailable. Location details are still shown below.</div>}
  </div>;
}
