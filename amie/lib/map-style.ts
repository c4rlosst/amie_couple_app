import type {StyleSpecification, SymbolLayerSpecification} from 'maplibre-gl';

export function mapStyle(dark: boolean): StyleSpecification {
  const colors = dark
    ? {land: '#242c36', park: '#29403b', water: '#1d334c', border: '#586675', major: '#677586', local: '#495667', text: '#d1d9e3'}
    : {land: '#e9eef1', park: '#d5e8de', water: '#c8e0ef', border: '#b8c6d0', major: '#fff', local: '#f9fbfc', text: '#5b6979'};
  const text = {'text-color': colors.text, 'text-halo-color': colors.land, 'text-halo-width': 1};
  const place: SymbolLayerSpecification['layout'] = {
    'text-field': ['coalesce', ['get', 'name_en'], ['get', 'name']],
    'text-font': ['Noto Sans Regular'],
    'text-padding': 8,
    'text-max-width': 8,
  };

  return {
    version: 8,
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: {
      streets: {type: 'vector', url: 'https://tiles.openfreemap.org/planet'},
      accuracy: {type: 'geojson', data: {type: 'FeatureCollection', features: []}},
    },
    layers: [
      {id: 'land', type: 'background', paint: {'background-color': colors.land}},
      {id: 'woods', type: 'fill', source: 'streets', 'source-layer': 'landcover', minzoom: 9,
        filter: ['==', ['get', 'class'], 'wood'], paint: {'fill-color': colors.park}},
      {id: 'parks', type: 'fill', source: 'streets', 'source-layer': 'park', minzoom: 9,
        paint: {'fill-color': colors.park}},
      {id: 'water', type: 'fill', source: 'streets', 'source-layer': 'water',
        paint: {'fill-color': colors.water}},
      {id: 'rivers', type: 'line', source: 'streets', 'source-layer': 'waterway', minzoom: 9,
        paint: {'line-color': colors.water, 'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 9, 0.6, 17, 7]}},
      {id: 'country-borders', type: 'line', source: 'streets', 'source-layer': 'boundary',
        filter: ['all', ['==', ['get', 'admin_level'], 2], ['!=', ['get', 'maritime'], 1], ['!=', ['get', 'disputed'], 1]],
        paint: {'line-color': colors.border, 'line-opacity': 0.65, 'line-width': 0.8}},
      {id: 'local-roads', type: 'line', source: 'streets', 'source-layer': 'transportation', minzoom: 11,
        filter: ['all', ['==', ['geometry-type'], 'LineString'], ['!=', ['get', 'brunnel'], 'tunnel'],
          ['match', ['get', 'class'], ['minor', 'service', 'tertiary'], true, false]],
        layout: {'line-cap': 'round', 'line-join': 'round'},
        paint: {'line-color': colors.local, 'line-width': ['interpolate', ['exponential', 1.45], ['zoom'], 11, 0.6, 15, 2.8, 19, 10]}},
      {id: 'main-roads', type: 'line', source: 'streets', 'source-layer': 'transportation', minzoom: 6,
        filter: ['all', ['==', ['geometry-type'], 'LineString'], ['!=', ['get', 'brunnel'], 'tunnel'],
          ['match', ['get', 'class'], ['motorway', 'trunk', 'primary', 'secondary'], true, false]],
        layout: {'line-cap': 'round', 'line-join': 'round'},
        paint: {'line-color': colors.major, 'line-width': ['interpolate', ['exponential', 1.4], ['zoom'], 6, 0.5, 12, 1.6, 15, 4.5, 19, 15]}},
      {id: 'gps-accuracy', type: 'circle', source: 'accuracy',
        paint: {
          'circle-color': ['get', 'color'], 'circle-opacity': 0.1,
          'circle-radius': ['interpolate', ['exponential', 2], ['zoom'],
            0, ['get', 'radius'], 8, ['min', 128, ['*', ['get', 'radius'], 256]],
            12, ['min', 256, ['*', ['get', 'radius'], 4096]], 19, ['min', 512, ['*', ['get', 'radius'], 524288]]],
        }},
      {id: 'countries', type: 'symbol', source: 'streets', 'source-layer': 'place', maxzoom: 8,
        filter: ['==', ['get', 'class'], 'country'],
        layout: {...place, 'symbol-sort-key': ['coalesce', ['get', 'rank'], 10], 'text-size': ['interpolate', ['linear'], ['zoom'], 2, 10, 7, 13]}, paint: text},
      {id: 'cities', type: 'symbol', source: 'streets', 'source-layer': 'place', minzoom: 5,
        filter: ['match', ['get', 'class'], ['city', 'town'], true, false],
        layout: {...place, 'symbol-sort-key': ['coalesce', ['get', 'rank'], 20], 'text-size': ['interpolate', ['linear'], ['zoom'], 5, 10, 13, 15]}, paint: text},
      {id: 'neighborhoods', type: 'symbol', source: 'streets', 'source-layer': 'place', minzoom: 13,
        filter: ['match', ['get', 'class'], ['suburb', 'quarter', 'neighbourhood', 'village'], true, false],
        layout: {...place, 'text-size': 11}, paint: text},
    ],
  };
}
