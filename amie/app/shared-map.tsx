/// <reference types="vite/client" />
'use client';

import {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import type {GeoJSONSource, Map as VectorMap, Marker as VectorMarker} from 'maplibre-gl';
import {Focus, Info, Navigation, LoaderCircle, MapPin} from 'lucide-react';
import {mapLongitude, type MapPoint} from '../lib/location';
import {mapStyle} from '../lib/map-style';
import Avatar from './profile-avatar';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';

type Props = {
  points: MapPoint[];
  dark: boolean;
  preview?: boolean;
  focusRequest?: {id: string; version: number} | null;
};

const initialCenter: [number, number] = [0, 20];
const initialZoom = 1.5;

export default function SharedMap({points, dark, preview=false, focusRequest}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const currentTheme = useRef(dark);
  currentTheme.current = dark;
  const currentPoints = useRef(points);
  currentPoints.current = points;
  const [view, setView] = useState<{map: VectorMap; Marker: typeof VectorMarker} | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [tileError, setTileError] = useState(false);
  const markers = useRef(new Map<string, VectorMarker>());
  const [markerTargets,setMarkerTargets] = useState<Map<string, HTMLElement>>(()=>new Map());
  const fitted = useRef<string | null>(null);

  useEffect(() => {
    let disposed = false;
    let map: VectorMap | undefined;
    let observer: ResizeObserver | undefined;
    const timeout = setTimeout(() => { if (!disposed) setTileError(true); }, 15000);

    void import('maplibre-gl').then(({Map, Marker, NavigationControl, setWorkerUrl}) => {
      if (disposed || !container.current) return;
      setWorkerUrl(workerUrl);
      map = new Map({
        container: container.current,
        style: mapStyle(currentTheme.current),
        center: initialCenter,
        zoom: initialZoom,
        maxZoom: 19,
        attributionControl: false,
        scrollZoom: false,
        dragRotate: false,
        touchPitch: false,
        interactive: !preview,
      });
      map.touchZoomRotate.disableRotation();
      if (!preview) map.addControl(new NavigationControl({showCompass: false}), 'bottom-left');
      map.on('load', () => {
        clearTimeout(timeout);
        if (!disposed) setLoaded(true);
      });
      map.on('error', () => { if (!disposed) setTileError(true); });
      map.on('sourcedata', event => {
        if (!disposed && event.sourceId === 'streets' && event.sourceDataType === 'content') setTileError(false);
      });

      const instance = map;
      observer = new ResizeObserver(() => instance.resize());
      observer.observe(container.current);
      setView({map, Marker});
    }).catch(() => {
      clearTimeout(timeout);
      if (!disposed) setFailed(true);
    });

    return () => {
      disposed = true;
      clearTimeout(timeout);
      observer?.disconnect();
      markers.current.clear();
      map?.remove();
    };
  }, [preview]);

  useEffect(() => {
    if (!view || !loaded) return;
    for (const layer of mapStyle(dark).layers) {
      if ('paint' in layer) {
        for (const [property, value] of Object.entries(layer.paint ?? {})) {
          view.map.setPaintProperty(layer.id, property as Parameters<VectorMap['setPaintProperty']>[1], value);
        }
      }
    }
  }, [view, loaded, dark]);

  useEffect(() => {
    if (!view) return;
    const {map, Marker} = view;
    const currentIds = new Set(points.map(point => point.id));
    let markersChanged = false;
    for (const [id, marker] of markers.current) {
      if (currentIds.has(id)) continue;
      marker.remove();
      markers.current.delete(id);
      markersChanged = true;
    }

    for (const point of points) {
      let marker = markers.current.get(point.id);
      if (!marker) {
        const element = document.createElement('div');
        element.className = `map-person-pin ${point.own ? 'own' : 'partner'}`;
        marker = new Marker({element}).setLngLat(coordinates(point)).addTo(map);
        markers.current.set(point.id, marker);
        markersChanged = true;
      }
      marker.setLngLat(coordinates(point));
    }
    if(markersChanged)setMarkerTargets(new Map([...markers.current].map(([id,marker])=>[id,marker.getElement()])));

    map.getSource<GeoJSONSource>('accuracy')?.setData({
      type: 'FeatureCollection',
      features: points.filter(point => point.accuracy !== null && point.accuracy > 0).map(point => {
        const position = coordinates(point);
        return {
          type: 'Feature',
          geometry: {type: 'Point', coordinates: position},
          properties: {
            color: point.own ? '#007aff' : '#95628f',
            radius: 512 * (point.accuracy ?? 0) / (40075016.7 * Math.cos(position[1] * Math.PI / 180)),
          },
        };
      }),
    });

    const ids = JSON.stringify(preview ? points.map(coordinates) : [...currentIds]);
    if (ids === fitted.current) return;
    fitted.current = ids;
    if (points.length) fitLocations(map, points);
    else map.jumpTo({center: initialCenter, zoom: initialZoom});
  }, [view, loaded, points, preview]);

  useEffect(() => {
    if (!view || !focusRequest) return;
    const selected = currentPoints.current.find(point => point.id === focusRequest.id);
    if (selected) fitLocations(view.map, [selected]);
  }, [view, focusRequest]);

  const recenter = points.find(point => point.own) ?? points[0];
  return <div className="shared-map-wrap">
    <div ref={container} className="shared-map" role="region" aria-label="Map of your last shared locations"/>
    {points.map(point=>{
      const target=markerTargets.get(point.id);
      return target&&createPortal(<><Avatar name={point.name} id={point.id} version={point.avatarVersion} partner={!point.own} small/>{!point.own&&!preview&&<span className="map-person-label" aria-hidden="true">{point.name}</span>}</>,target,point.id);
    })}
    {!loaded && !failed && !tileError && <div className="map-loading" role="status"><LoaderCircle size={22} className="spin"/>Loading map…</div>}
    {failed && <div className="map-loading" role="alert"><MapPin size={24}/>The map couldn’t load. Saved locations are available below.</div>}
    {!preview && loaded && view && recenter && <div className="map-controls" aria-label="Map controls" role="group">
      {points.length > 1 && <button type="button" onClick={() => fitLocations(view.map, points)} aria-label="Show both locations"><Focus size={20}/></button>}
      <button type="button" onClick={() => fitLocations(view.map, [recenter])} aria-label={recenter.own ? 'Center on your saved location' : 'Center on your partner’s saved location'}><Navigation size={20}/></button>
    </div>}
    {loaded && <details className="map-credits">
      <summary aria-label="Map credits" title="Map credits"><Info size={17}/></summary>
      <div className="map-credits-links">
        <a href="https://openfreemap.org/" target="_blank" rel="noreferrer">OpenFreeMap</a>
        <a href="https://openmaptiles.org/" target="_blank" rel="noreferrer">© OpenMapTiles</a>
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>
      </div>
    </details>}
    {tileError && <div className="map-tile-error" role="status">The map couldn’t load this area. Saved locations are available below.</div>}
  </div>;
}

function coordinates(point: MapPoint): [number, number] {
  return [point.longitude, Math.max(-85.05, Math.min(85.05, point.latitude))];
}

function fitLocations(map: VectorMap, points: MapPoint[]) {
  map.resize();
  const anchor = points[0].longitude;
  const locations = points.map(point => {
    const [, latitude] = coordinates(point);
    return [mapLongitude(point.longitude, anchor), latitude];
  });
  const lngs = locations.map(([longitude]) => longitude);
  const lats = locations.map(([, latitude]) => latitude);
  const canvas = map.getContainer();
  const padding = Math.min(40, Math.floor(Math.min(canvas.clientWidth, canvas.clientHeight) / 4));
  map.fitBounds(
    [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
    {padding, maxZoom: points.some(point => (point.accuracy ?? 0) > 500) ? 12 : 15, duration: 0},
  );
}
