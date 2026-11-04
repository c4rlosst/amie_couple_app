export const API_ORIGIN='https://amie-api.amie-c4rlosst.workers.dev';
const KEY='amie.session.v1';
export function sessionToken(){return typeof window==='undefined'?null:localStorage.getItem(KEY);}
export function saveSession(token:string|null){if(token)localStorage.setItem(KEY,token);else localStorage.removeItem(KEY);}
export function assetUrl(file:string){return `${typeof window!=='undefined'&&window.location.pathname.startsWith('/couple_app/')?'/couple_app/':'/'}${file}`;}
export function apiFetch(path:string,init:RequestInit={}){const headers=new Headers(init.headers);const token=sessionToken();if(token)headers.set('Authorization',`Bearer ${token}`);return fetch(`${API_ORIGIN}${path}`,{...init,headers,credentials:'omit'});}
