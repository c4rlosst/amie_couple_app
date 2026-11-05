import test from 'node:test';
import assert from 'node:assert/strict';
import {locationPoint,distanceMetres,formatDistance,locationAge,mapLongitude} from '../lib/location.ts';

const member=(latitude,longitude,extra={})=>({id:'a',name:'Your person',latitude,longitude,accuracy:15,location_at:1000,...extra});
test('shared locations accept zero coordinates and reject missing or invalid fixes',()=>{
  assert.equal(locationPoint(member(0,0),true).name,'You');
  for(const coordinates of [[null,0],[0,null],[91,0],[0,-181],[NaN,0],[0,Infinity]])assert.equal(locationPoint(member(...coordinates)),null);
  assert.equal(locationPoint(member(1,1,{location_at:null})),null);
  assert.equal(locationPoint(member(1,1,{location_at:Infinity})),null);
  assert.equal(locationPoint(member(1,1,{accuracy:null})).accuracy,null);
});
test('distance is geographical and handles the equator, identical points and the dateline',()=>{
  const point=(lat,lng)=>locationPoint(member(lat,lng));
  assert.equal(distanceMetres(point(0,0),point(0,0)),0);
  assert.ok(Math.abs(distanceMetres(point(0,0),point(0,1))-111195)<10);
  assert.ok(Math.abs(distanceMetres(point(0,179),point(0,-179))-222390)<10);
  const londonToNewYork=distanceMetres(point(51.5074,-.1278),point(40.7128,-74.006));
  assert.ok(londonToNewYork>5500000&&londonToNewYork<5650000);
  assert.equal(mapLongitude(-179,179),181);
});
test('distance and freshness labels distinguish metres, kilometres and old locations',()=>{
  assert.equal(formatDistance(4),'4 m');assert.equal(formatDistance(1234),'1.2 km');
  assert.equal(locationAge(1000,1000),'Updated just now');
  assert.equal(locationAge(1000,301000),'Updated 5 min ago');
  assert.equal(locationAge(1000,7201000),'Updated 2 hr ago');
  assert.equal(locationAge(1000,172801000),'Updated 2 days ago');
});
