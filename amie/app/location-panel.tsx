'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {ArrowUpRight,ChevronRight,ChevronDown,MapPin,Navigation,ShieldCheck,Search} from 'lucide-react';
import SharedMap from './shared-map';
import {distanceMetres,formatDistance,locationAge,locationPoint,type SharedLocation} from '../lib/location';

type Props={me?:SharedLocation;partner?:SharedLocation|null;watching:boolean;busy:boolean;onShare:()=>void;onStop:()=>void;onOpenMap?:()=>void;full?:boolean;dark?:boolean;mapAllowed:boolean;onMapAllowed:(value:boolean)=>void};
export default function LocationPanel({me,partner,watching,busy,onShare,onStop,onOpenMap,full=false,dark=false,mapAllowed,onMapAllowed}:Props){
  const [expanded,setExpanded]=useState(false);const [query,setQuery]=useState('');const search=useRef<HTMLInputElement>(null);
  const [focusRequest,setFocusRequest]=useState<{id:string;version:number}|null>(null);
  function locate(id:string){search.current?.blur();setQuery('');setExpanded(false);setFocusRequest(previous=>({id,version:(previous?.version??0)+1}));}
  const drag=useRef<number|null>(null);
  const dragged=useRef(false);
  function showDetails(value:boolean){
    if(!value){search.current?.blur();setQuery('');}
    setExpanded(value);
  }
  const [now,setNow]=useState(Date.now());
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(timer);},[]);
  const own=useMemo(()=>locationPoint(me,true),[me]);const other=useMemo(()=>locationPoint(partner),[partner]);
  const points=useMemo(()=>[own,other].filter((point):point is NonNullable<typeof point>=>!!point),[own,other]);
  const previewPoints=useMemo(()=>other?[other]:[],[other]);
  const distance=own&&other?distanceMetres(own,other):null;
  const people=[{member:me,point:own,label:'You',own:true},{member:partner,point:other,label:partner?.name||'Your person',own:false}].filter(person=>(full||!person.own)&&(!query||`${person.label} ${person.member?.name||''}`.toLowerCase().includes(query.toLowerCase())));
  const details=<>
    {full&&distance!==null&&<p className="map-distance-note">Straight-line distance between saved locations.</p>}
    <div className="location-people">{people.map(person=><div className="location-person" key={person.own?'you':'partner'}>
      <button className="location-person-target" type="button" disabled={!full||!mapAllowed||!person.point} aria-label={`Show ${person.label} on map`} onPointerDown={event=>event.preventDefault()} onClick={()=>person.point&&locate(person.point.id)}><span className={`location-person-dot ${person.own?'own':'partner'}`} aria-hidden="true"/>
      <div><h3>{person.label}</h3><p>{person.point?locationAge(person.point.updatedAt,now):person.member?'No location shared':'Not connected yet'}</p>{full&&person.point&&<small>{now-person.point.updatedAt>=300000?'May be out of date · ':''}{person.point.accuracy===null?'Accuracy unavailable':`Accuracy about ${formatDistance(person.point.accuracy)}`}</small>}</div></button>
      {full&&person.point&&<a className="icon-button" href={`https://maps.apple.com/?ll=${person.point.latitude},${person.point.longitude}&q=Shared%20location`} target="_blank" rel="noreferrer" aria-label={`Open ${person.label}'s location in Apple Maps`}><ArrowUpRight size={19}/></a>}
    </div>)}{!people.length&&<p role="status" className="map-no-results">No matching person. Try your name or your partner’s name.</p>}</div>
    {!full&&mapAllowed&&other&&<div className="location-preview"><SharedMap points={previewPoints} dark={dark} preview/></div>}
    {full&&<div className="location-sharing"><span className={`sharing-indicator ${watching?'on':''}`}/><p>{watching?own?'Sharing while Amie is open':'Finding your location…':own?'Your last location is saved':'Your location is not shared'}</p></div>}
    {(!full||!watching)&&<button className="button secondary location-share-button" onClick={onShare} disabled={busy||watching}><Navigation size={17}/>{own?'Update my location':'Share my location'}</button>}
    {full&&(watching||own)&&<button className="text-button stop-sharing" onClick={onStop} disabled={busy}>Stop & remove my location</button>}
    {full&&<p className="location-explainer"><ShieldCheck size={15}/>Updates about every five minutes while Amie is open. Stopping removes your saved location.</p>}
    {full&&mapAllowed&&<button className="text-button hide-map" onClick={()=>{showDetails(false);onMapAllowed(false);}}>Hide map</button>}
  </>;
  return <section className={`location-panel ${full?'location-full':''}`} aria-label="Shared locations">
    {!full&&<div className="section-heading"><h2>Location</h2>{onOpenMap&&<button className="text-button" onClick={onOpenMap}>View map<ChevronRight size={16}/></button>}</div>}
    {full&&(mapAllowed?<SharedMap points={points} dark={dark} focusRequest={focusRequest}/>:<div className="map-consent">
      <MapPin size={26}/>
      <h3>Your shared map</h3>
      <small>OpenFreeMap receives your IP address and the map area you view. Amie draws your saved pins on the map.</small>
      <button className="button secondary" onClick={()=>onMapAllowed(true)}>Load map</button>
      <small className="map-consent-credit">Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a></small>
    </div>)}
    <div className={full?'map-dock':'location-summary'}>
    <div className={full?'location-sheet':undefined}>
    {full&&<>
      <button type="button" className="location-sheet-toggle" aria-expanded={expanded} aria-controls="map-location-details"
        onPointerDown={event=>{drag.current=event.clientY;dragged.current=false;event.currentTarget.setPointerCapture(event.pointerId);}}
        onPointerUp={event=>{
          if(drag.current!==null&&Math.abs(event.clientY-drag.current)>30){
            dragged.current=true;
            showDetails(event.clientY<drag.current);
          }
          drag.current=null;
        }}
        onPointerCancel={()=>{drag.current=null;}}
        onClick={event=>{if(!dragged.current||event.detail===0)showDetails(!expanded);dragged.current=false;}}>
        <span className="map-sheet-grip" aria-hidden="true"><span/></span>
        <span className="map-sheet-summary">
          <span className="map-summary-label">{watching?'Sharing my location':'Our map'}</span>
          {distance!==null&&<strong className="map-distance">{formatDistance(distance)} apart</strong>}
          <ChevronDown size={15} className={expanded?'expanded':''}/>
        </span>
      </button>
      {mapAllowed&&<form className="map-people-search" onSubmit={event=>{event.preventDefault();const first=people.find(person=>person.point);if(first?.point)locate(first.point.id);}}>
        <Search size={17}/><input ref={search} type="search" aria-label="Find a person on the map" placeholder="Find a person" value={query} onFocus={()=>setExpanded(true)} onChange={event=>setQuery(event.target.value)}/>
      </form>}
    </>}
    {full?<div id="map-location-details" className="map-sheet-disclosure" data-expanded={expanded} inert={!expanded}>
      <div className="map-sheet-disclosure-inner">{details}</div>
    </div>:details}
    </div>
    </div>
  </section>;
}
