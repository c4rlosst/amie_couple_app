'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {ArrowUpRight,ChevronLeft,ChevronRight,ChevronDown,MapPin,Navigation,ShieldCheck,Search,Focus} from 'lucide-react';
import SharedMap from './shared-map';
import {distanceMetres,formatDistance,locationAge,locationPoint,type SharedLocation} from '../lib/location';

type Props={me?:SharedLocation;partner?:SharedLocation|null;watching:boolean;busy:boolean;onShare:()=>void;onStop:()=>void;onOpenMap?:()=>void;onBack?:()=>void;full?:boolean;mapAllowed:boolean;onMapAllowed:(value:boolean)=>void};
export default function LocationPanel({me,partner,watching,busy,onShare,onStop,onOpenMap,onBack,full=false,mapAllowed,onMapAllowed}:Props){
  const [expanded,setExpanded]=useState(false);const [query,setQuery]=useState('');const search=useRef<HTMLInputElement>(null);
  const [focusRequest,setFocusRequest]=useState<{id:string;version:number}|null>(null);
  function locate(id:string){search.current?.blur();setQuery('');setExpanded(false);setFocusRequest(previous=>({id,version:(previous?.version??0)+1}));}
  const drag=useRef<number|null>(null);const ignoreGrabClick=useRef(false);
  const [now,setNow]=useState(Date.now());
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(timer);},[]);
  const own=useMemo(()=>locationPoint(me,true),[me]);const other=useMemo(()=>locationPoint(partner),[partner]);
  const points=useMemo(()=>[own,other].filter((point):point is NonNullable<typeof point>=>!!point),[own,other]);
  const distance=own&&other?distanceMetres(own,other):null;
  const people=[{member:me,point:own,label:'You',own:true},{member:partner,point:other,label:partner?.name||'Your person',own:false}].filter(person=>!full||!query||`${person.label} ${person.member?.name||''}`.toLowerCase().includes(query.toLowerCase()));
  return <section className={`location-panel ${full?'location-full':''}`} aria-label="Shared locations">
    <div className="section-heading">{full&&onBack&&<button className="icon-button map-back" aria-label="Back to Home" onClick={onBack}><ChevronLeft size={24}/></button>}<h2>{full?'Our places':'Location'}</h2>{onOpenMap?<button className="text-button" onClick={onOpenMap}>View map<ChevronRight size={16}/></button>:<MapPin size={19}/>}</div>
    {full&&(mapAllowed?<><SharedMap points={points} focusRequest={focusRequest}/></>:<div className="map-consent"><MapPin size={30}/><h3>{points.length?'See each other on the map':'Your places, together'}</h3><p>{points.length?'Load an OpenStreetMap map around your shared locations.':'Browse the map, or share a location to add your pin. Your partner appears when they share too.'}</p><><small>The map provider receives your IP address and the area you view. Names and pins stay in Amie.</small><button className="button secondary" onClick={()=>onMapAllowed(true)}>Load map</button></></div>)}
    <div className={full?'location-sheet':'location-summary'}>
    {full&&<><button type="button" className="map-sheet-grab" aria-label={expanded?'Collapse location details':'Expand location details'} aria-expanded={expanded} onPointerDown={event=>{drag.current=event.clientY;ignoreGrabClick.current=false;event.currentTarget.setPointerCapture(event.pointerId);search.current?.blur();}} onPointerUp={event=>{if(drag.current!==null&&Math.abs(event.clientY-drag.current)>30){setExpanded(event.clientY<drag.current);ignoreGrabClick.current=true;}drag.current=null;}} onPointerCancel={()=>{drag.current=null;}} onClick={()=>{if(ignoreGrabClick.current){ignoreGrabClick.current=false;return;}setExpanded(value=>!value);}}><span className="map-sheet-handle" aria-hidden="true"/></button><form className="map-people-search" onSubmit={event=>{event.preventDefault();const first=people.find(person=>person.point);if(first?.point&&mapAllowed)locate(first.point.id);}}><Search size={19}/><input ref={search} type="search" aria-label="Find a person on the map" placeholder="Find you or your person" value={query} onFocus={()=>setExpanded(true)} onChange={event=>setQuery(event.target.value)}/></form></>}
    {full?<button type="button" className="location-sheet-toggle" aria-expanded={expanded} onClick={()=>setExpanded(value=>!value)}><span><strong>{distance!==null?`About ${formatDistance(distance)} apart`:'Your shared locations'}</strong><small>{distance!==null?'Straight-line distance · last shared locations':'Tap to see location details'}</small></span><ChevronDown size={20} className={expanded?'expanded':''}/></button>:distance!==null&&<div className="location-distance"><strong>About {formatDistance(distance)} apart</strong><span>Between your last shared locations · straight-line distance</span></div>}
    <div className="location-people" hidden={full&&!expanded}>{people.map(person=><div className="location-person" key={person.own?'you':'partner'}>
      <button className="location-person-target" type="button" disabled={!full||!mapAllowed||!person.point} aria-label={`Show ${person.label} on map`} onPointerDown={event=>event.preventDefault()} onClick={()=>person.point&&locate(person.point.id)}><span className={`location-person-dot ${person.own?'own':'partner'}`} aria-hidden="true"/>
      <div><h3>{person.label}</h3><p>{person.point?locationAge(person.point.updatedAt,now):person.member?'No location shared':'Not connected yet'}</p>{person.point&&<small>{now-person.point.updatedAt>=300000?'May be out of date · ':''}{person.point.accuracy===null?'Accuracy unavailable':`Accuracy about ${formatDistance(person.point.accuracy)}`}</small>}</div></button>
      {person.point&&<a className="icon-button" href={`https://maps.apple.com/?ll=${person.point.latitude},${person.point.longitude}&q=Shared%20location`} target="_blank" rel="noreferrer" aria-label={`Open ${person.label}'s location in Maps`}><ArrowUpRight size={19}/></a>}
    </div>)}{!people.length&&<p role="status" className="map-no-results">No matching person. Try your name or your partner’s name.</p>}{full&&mapAllowed&&points.length>1&&<button className="text-button map-show-both" onPointerDown={event=>event.preventDefault()} onClick={()=>locate('all')}><Focus size={16}/>Show both locations</button>}</div>
    <div className="location-sharing"><span className={`sharing-indicator ${watching?'on':''}`}/><p>{watching?own?'Sharing while Amie is open':'Finding your location…':own?'Your last location is saved':'Your location is not shared'}</p></div>
    {!watching&&<button className="button secondary location-share-button" onClick={onShare} disabled={busy}><Navigation size={17}/>{own?'Update my location':'Share my location'}</button>}
    {(watching||own)&&<button className="text-button stop-sharing" onClick={onStop} disabled={busy}>Stop & remove my location</button>}
    <p className="location-explainer" hidden={full&&!expanded}><ShieldCheck size={15}/>Updates only while Amie is open. Stopping removes your saved location.</p>
    {full&&expanded&&mapAllowed&&<button className="text-button hide-map" onClick={()=>onMapAllowed(false)}>Hide map</button>}
    </div>
  </section>;
}
