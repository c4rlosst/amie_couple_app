'use client';

import {useEffect, useState} from 'react';

const storageKey = 'amie.map.appearance';
const choices = [
  {value: 'light', label: 'Light'},
  {value: 'dark', label: 'Dark'},
  {value: 'system', label: 'System'},
] as const;
type Appearance = typeof choices[number]['value'];

export function useMapAppearance() {
  const [appearance, setAppearance] = useState<Appearance>('light');
  const [systemDark, setSystemDark] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved === 'light' || saved === 'dark' || saved === 'system') setAppearance(saved);
    } catch {}
    const preference = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setSystemDark(preference.matches);
    update();
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);

  function saveAppearance(value: Appearance) {
    setAppearance(value);
    try { localStorage.setItem(storageKey, value); } catch {}
  }

  return {appearance, saveAppearance, darkMap: appearance === 'dark' || (appearance === 'system' && systemDark)};
}

export function MapAppearanceSettings({appearance, onChange}: {appearance: Appearance; onChange: (value: Appearance) => void}) {
  return <fieldset className="map-appearance-setting">
    <legend>Map appearance</legend>
    <div className="map-appearance-options">
      {choices.map(({value, label}) => <label key={value}>
        <input type="radio" name="map-appearance" value={value} checked={appearance === value} onChange={() => onChange(value)}/>
        <span>{label}</span>
      </label>)}
    </div>
  </fieldset>;
}
