'use client';

import {useEffect, useRef, useState} from 'react';
import {load, type Annotation, type Map as AppleMap, type MapKit} from '@apple/mapkit-loader';
import {LoaderCircle, MapPin, Navigation} from 'lucide-react';
import type {MapPoint} from '../lib/location';

const token = import.meta.env?.VITE_MAPKIT_TOKEN?.trim() ?? '';
export const mapKitConfigured = Boolean(token);

let kitPromise: Promise<MapKit> | undefined;
function loadAppleMaps() {
  kitPromise ??= load({libraries: ['full-map']}).then(kit => new Promise<MapKit>((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      kit.removeEventListener('configuration-change', onReady);
      kit.removeEventListener('error', onError);
    };
    const onReady = () => { cleanup(); resolve(kit); };
    const onError = () => { cleanup(); reject(new Error('Apple Maps could not initialize.')); };
    const timer = setTimeout(onError, 15000);

    kit.addEventListener('configuration-change', onReady, {once: true});
    kit.addEventListener('error', onError, {once: true});
    try {
      kit.init({authorizationCallback: done => done(token)});
    } catch {
      onError();
    }
  }));
  return kitPromise;
}

type FocusRequest = {id: string; version: number} | null;
type Props = {points: MapPoint[]; dark: boolean; focusRequest?: FocusRequest};

export default function SharedMap({points, dark, focusRequest}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<{kit: MapKit; instance: AppleMap} | null>(null);
  const [failed, setFailed] = useState(false);
  const annotations = useRef(new Map<string, Annotation>());
  const lastPoints = useRef('');
  const fitted = useRef('');
  const color = dark ? 'dark' : 'light';

  useEffect(() => {
    let active = true;
    let instance: AppleMap | undefined;
    let kit: MapKit | undefined;
    const onError = () => { if (active) setFailed(true); };
    const timer = setTimeout(onError, 20000);

    void loadAppleMaps().then(loadedKit => {
      if (!active || !container.current) return;
      kit = loadedKit;
      kit.addEventListener('error', onError);
      instance = new kit.Map(container.current, {
        mapType: kit.MapType.Standard,
        showsMapTypeControl: true,
        showsCompass: kit.FeatureVisibility.Adaptive,
        showsZoomControl: window.matchMedia('(pointer: fine)').matches,
        showsUserLocationControl: false,
        showsUserLocation: false,
      });
      clearTimeout(timer);
      setFailed(false);
      setMap({kit, instance});
    }).catch(onError);

    return () => {
      active = false;
      clearTimeout(timer);
      kit?.removeEventListener('error', onError);
      instance?.destroy();
    };
  }, []);

  useEffect(() => {
    if (map) map.instance.colorScheme = color === 'dark' ? map.kit.ColorScheme.Dark : map.kit.ColorScheme.Light;
  }, [map, color]);

  useEffect(() => {
    if (!map) return;
    const signature = JSON.stringify(points);
    if (signature === lastPoints.current) return;
    lastPoints.current = signature;
    const {kit, instance} = map;
    const next = new Map<string, Annotation>();
    const accuracy = [];
    for (const point of points) {
      const coordinate = new kit.Coordinate(point.latitude, point.longitude);
      const tint = point.own ? '#007aff' : '#af52de';
      const pin = point.own ? new kit.Annotation(coordinate, () => {
        const dot = document.createElement('div');
        dot.className = 'apple-location-dot';
        dot.setAttribute('aria-label', 'Your last shared location');
        return dot;
      }, {title: 'You'}) : new kit.MarkerAnnotation(coordinate, {title: point.name, color: tint});
      next.set(point.id, pin);
      if (point.accuracy && point.accuracy < 20000000) {
        accuracy.push(new kit.CircleOverlay(coordinate, point.accuracy, {
          enabled: false,
          style: new kit.Style({fillColor: tint, fillOpacity: 0.08, strokeColor: tint, strokeOpacity: 0.3}),
        }));
      }
    }
    annotations.current = next;
    instance.annotations = [...next.values()];
    instance.overlays = accuracy;
    const ids = [...next.keys()].join(':');
    if (ids && ids !== fitted.current) fitMap(map, [...next.values()]);
    fitted.current = ids;
  }, [map, points]);

  useEffect(() => {
    if (!map || !focusRequest) return;
    const pin = annotations.current.get(focusRequest.id);
    fitMap(map, pin ? [pin] : [...annotations.current.values()]);
  }, [map, focusRequest]);

  const recenter = points.find(point => point.own) ?? points[0];
  return <div className="shared-map-wrap">
    <div ref={container} className="shared-map" role="region" aria-label="Apple Maps showing your last shared locations"/>
    {!map && !failed && <div className="map-loading" role="status"><LoaderCircle size={22} className="spin"/>Loading Apple Maps…</div>}
    {failed && <div className="map-loading" role="alert"><MapPin size={24}/>Apple Maps couldn’t load. You can open saved locations from the details below.</div>}
    {map && !failed && recenter && <button type="button" className="map-fit" aria-label={recenter.own ? 'Center on your saved location' : 'Center on your partner’s saved location'} onClick={() => {
      const pin = annotations.current.get(recenter.id);
      if (pin) fitMap(map, [pin]);
    }}><Navigation size={21}/></button>}
  </div>;
}

function fitMap({kit, instance}: {kit: MapKit; instance: AppleMap}, pins: Annotation[]) {
  if (pins.length) instance.showItems(pins, {
    animate: false,
    minimumSpan: new kit.CoordinateSpan(0.008, 0.008),
    padding: new kit.Padding(40, 36, 44, 36),
  });
}
