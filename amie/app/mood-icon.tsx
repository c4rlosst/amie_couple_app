export const moods = [
  {id:'happy', label:'Happy', description:'Feeling cheerful'},
  {id:'loved', label:'Loved', description:'Feeling cared for and connected'},
  {id:'okay', label:'Okay', description:'Feeling neutral or steady'},
  {id:'tired', label:'Tired', description:'Feeling sleepy or low on energy'},
  {id:'low', label:'Low', description:'Feeling down'},
] as const;

/** One face silhouette and stroke style; only the expression changes. */
export default function MoodIcon({mood}:{mood:string}) {
  const eyes = <><circle cx="8.5" cy="10" r=".85" fill="currentColor" stroke="none"/><circle cx="15.5" cy="10" r=".85" fill="currentColor" stroke="none"/></>;
  const smile = <path d="M8 14c1.5 2.7 6.5 2.7 8 0"/>;
  let expression;
  switch(mood) {
    case 'happy':
      expression = <>{eyes}{smile}</>;
      break;
    case 'loved':
      expression = <>
        <path d="m8.25 11.2-1.95-1.95a1.3 1.3 0 0 1 1.95-1.7 1.3 1.3 0 0 1 1.95 1.7Z" fill="currentColor" stroke="none"/>
        <path d="m15.75 11.2-1.95-1.95a1.3 1.3 0 0 1 1.95-1.7 1.3 1.3 0 0 1 1.95 1.7Z" fill="currentColor" stroke="none"/>
        {smile}
      </>;
      break;
    case 'tired':
      expression = <><path d="M6.8 10q1.7 1.8 3.4 0m3.6 0q1.7 1.8 3.4 0"/><ellipse cx="12" cy="15" rx="1.5" ry="2"/></>;
      break;
    case 'low':
      expression = <>{eyes}<path d="M8 16c1.5-2.7 6.5-2.7 8 0"/></>;
      break;
    default:
      expression = <>{eyes}<path d="M8.5 15h7"/></>;
  }
  return <svg className="mood-icon" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9"/>{expression}</svg>;
}
