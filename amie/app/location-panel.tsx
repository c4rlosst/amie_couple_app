'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {ArrowUpRight,ChevronRight,ChevronDown,MapPin,Navigation,ShieldCheck,Search,Focus} from 'lucide-react';
import SharedMap from './shared-map';
import {distanceMetres,formatDistance,locationAge,locationPoint,type SharedLocation} from '../lib/location';

type Props={me?:SharedLocation;partner?:SharedLocation|null;watching:boolean;busy:boolean;onShare:()=>void;onStop:()=>void;onOpenMap?:()=>void;full?:boolean;mapAllowed:boolean;onMapAllowed:(value:boolean)=>void};
export default function LocationPanel({me,partner,watching,busy,onShare,onStop,onOpenMap,full=false,mapAllowed,onMapAllowed}:Props){
  const [expanded,setExpanded]=useState(false);const [query,setQuery]=useState('');const search=useRef<HTMLInputElement>(null);
  const [focusRequest,setFocusRequest]=useState<{id:string;version:number}|null>(null);
  function locate(id:string){search.current?.blur();setQuery('');setExpanded(false);setFocusRequest(previous=>({id,version:(previous?.version??0)+1}));}
  const drag=useRef<number|null>(null);
  function showDetails(value:boolean){
    if(!value){search.current?.blur();setQuery('');}
    setExpanded(value);
  }
  const [now,setNow]=useState(Date.now());
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(timer);},[]);
  const own=useMemo(()=>locationPoint(me,true),[me]);const other=useMemo(()=>locationPoint(partner),[partner]);
  const points=useMemo(()=>[own,other].filter((point):point is NonNullable<typeof point>=>!!point),[own,other]);
  const distance=own&&other?distanceMetres(own,other):null;
  const people=[{member:me,point:own,label:'You',own:true},{member:partner,point:other,label:partner?.name||'Your person',own:false}].filter(person=>!full||!query||`${person.label} ${person.member?.name||''}`.toLowerCase().includes(query.toLowerCase()));
  return <section className={`location-panel ${full ? `location-full${mapAllowed ? '' : ' map-awaiting-tiles'}` : ''}`} aria-label="Shared locations">
    {!full&&<div className="section-heading"><h2>Location</h2>{onOpenMap&&<button className="text-button" onClick={onOpenMap}>View map<ChevronRight size={16}/></button>}</div>}
    {full&&(mapAllowed?<SharedMap points={points} focusRequest={focusRequest}/>:<div className="map-consent">
      <MapPin size={26}/>
      <h3>Your shared map</h3>
      <small>OpenStreetMap receives your IP address and the map area you view. Names and pins stay in Amie.</small>
      <button className="button secondary" onClick={()=>onMapAllowed(true)}>Load map</button>
    </div>)}
    <div className={full?'map-dock':'location-summary'}>
    {full&&mapAllowed&&<div className="map-attribution">© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors</div>}
    <div className={full?'location-sheet':undefined}>
    {full&&<>
      <div className="map-sheet-grip" aria-hidden="true"
        onPointerDown={event=>{drag.current=event.clientY;event.currentTarget.setPointerCapture(event.pointerId);}}
        onPointerUp={event=>{
          if(drag.current!==null){const delta=event.clientY-drag.current;showDetails(Math.abs(delta)>30?delta<0:!expanded);}
          drag.current=null;
        }}
        onPointerCancel={()=>{drag.current=null;}}><span/></div>
      {mapAllowed&&<form className="map-people-search" onSubmit={event=>{event.preventDefault();const first=people.find(person=>person.point);if(first?.point)locate(first.point.id);}}>
        <Search size={17}/><input ref={search} type="search" aria-label="Find a person on the map" placeholder="Find a person" value={query} onFocus={()=>setExpanded(true)} onChange={event=>setQuery(event.target.value)}/>
      </form>}
      <button type="button" className="location-sheet-toggle" aria-expanded={expanded} aria-controls="map-location-details" onClick={()=>showDetails(!expanded)}>
        <span>{watching?'Sharing my location':distance!==null?`About ${formatDistance(distance)} apart`:points.length?'Shared locations':'Location sharing'}</span>
        <ChevronDown size={15} className={expanded?'expanded':''}/>
      </button>
    </>}
    {!full&&distance!==null&&<div className="location-distance"><strong>About {formatDistance(distance)} apart</strong><span>Between your last shared locations · straight-line distance</span></div>}
    <div id={full?'map-location-details':undefined} hidden={full&&!expanded}>
    {full&&distance!==null&&<p className="map-distance-note">{watching?`About ${formatDistance(distance)} apart. `:''}Straight-line distance between saved locations.</p>}
    <div className="location-people">{people.map(person=><div className="location-person" key={person.own?'you':'partner'}>
      <button className="location-person-target" type="button" disabled={!full||!mapAllowed||!person.point} aria-label={`Show ${person.label} on map`} onPointerDown={event=>event.preventDefault()} onClick={()=>person.point&&locate(person.point.id)}><span className={`location-person-dot ${person.own?'own':'partner'}`} aria-hidden="true"/>
      <div><h3>{person.label}</h3><p>{person.point?locationAge(person.point.updatedAt,now):person.member?'No location shared':'Not connected yet'}</p>{person.point&&<small>{now-person.point.updatedAt>=300000?'May be out of date · ':''}{person.point.accuracy===null?'Accuracy unavailable':`Accuracy about ${formatDistance(person.point.accuracy)}`}</small>}</div></button>
      {person.point&&<a className="icon-button" href={`https://maps.apple.com/?ll=${person.point.latitude},${person.point.longitude}&q=Shared%20location`} target="_blank" rel="noreferrer" aria-label={`Open ${person.label}'s location in Maps`}><ArrowUpRight size={19}/></a>}
    </div>)}{!people.length&&<p role="status" className="map-no-results">No matching person. Try your name or your partner’s name.</p>}{full&&mapAllowed&&points.length>1&&<button className="text-button map-show-both" onPointerDown={event=>event.preventDefault()} onClick={()=>locate('all')}><Focus size={16}/>Show both locations</button>}</div>
    <div className="location-sharing"><span className={`sharing-indicator ${watching?'on':''}`}/><p>{watching?own?'Sharing while Amie is open':'Finding your location…':own?'Your last location is saved':'Your location is not shared'}</p></div>
    {!watching&&<button className="button secondary location-share-button" onClick={onShare} disabled={busy}><Navigation size={17}/>{own?'Update my location':'Share my location'}</button>}
    {(watching||own)&&<button className="text-button stop-sharing" onClick={onStop} disabled={busy}>Stop & remove my location</button>}
    <p className="location-explainer"><ShieldCheck size={15}/>Updates only while Amie is open. Stopping removes your saved location.</p>
    {full&&mapAllowed&&<button className="text-button hide-map" onClick={()=>{showDetails(false);onMapAllowed(false);}}>Hide map</button>}
    </div>
    </div>
    </div>
  </section>;
}
