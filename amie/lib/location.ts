export type SharedLocation={id:string;name:string;avatar_version?:string|null;latitude:number|null;longitude:number|null;accuracy:number|null;location_at:number|null};
export type MapPoint={id:string;name:string;avatarVersion?:string|null;latitude:number;longitude:number;accuracy:number|null;updatedAt:number;own:boolean};

export function locationPoint(member:SharedLocation|null|undefined,own=false):MapPoint|null{
  if(!member||typeof member.latitude!=='number'||typeof member.longitude!=='number'||!Number.isFinite(member.latitude)||!Number.isFinite(member.longitude)||Math.abs(member.latitude)>90||Math.abs(member.longitude)>180||typeof member.location_at!=='number'||!Number.isFinite(member.location_at)||member.location_at<=0)return null;
  return {id:member.id,name:own?'You':member.name,avatarVersion:member.avatar_version,latitude:member.latitude,longitude:member.longitude,accuracy:typeof member.accuracy==='number'&&Number.isFinite(member.accuracy)?Math.max(0,member.accuracy):null,updatedAt:member.location_at,own};
}
export function distanceMetres(a:MapPoint,b:MapPoint){
  const rad=(n:number)=>n*Math.PI/180;
  const value=Math.sin(rad(b.latitude-a.latitude)/2)**2+Math.cos(rad(a.latitude))*Math.cos(rad(b.latitude))*Math.sin(rad(b.longitude-a.longitude)/2)**2;
  return 6371000*2*Math.atan2(Math.sqrt(Math.min(1,value)),Math.sqrt(Math.max(0,1-value)));
}
export function formatDistance(metres:number){return metres<1000?`${metres<100?Math.round(metres):Math.round(metres/10)*10} m`:`${(metres/1000).toLocaleString(undefined,{maximumFractionDigits:1})} km`;}
export function locationAge(time:number,now=Date.now()){
  const minutes=Math.max(0,Math.floor((now-time)/60000));
  return minutes<1?'Updated just now':minutes<60?`Updated ${minutes} min ago`:minutes<1440?`Updated ${Math.floor(minutes/60)} hr ago`:`Updated ${Math.floor(minutes/1440)} ${minutes<2880?'day':'days'} ago`;
}
export function mapLongitude(longitude:number,anchor:number){return anchor+((longitude-anchor+540)%360)-180;}
