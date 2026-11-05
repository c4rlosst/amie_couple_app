'use client';

import {useLayoutEffect, useState} from 'react';

const storageKey = 'amie.appearance';
const choices = [
  {value: 'light', label: 'Light'},
  {value: 'dark', label: 'Dark'},
  {value: 'system', label: 'System'},
] as const;
export type Appearance = typeof choices[number]['value'];

export function useAppearance() {
  const [appearance, setAppearance] = useState<Appearance>('light');
  const [systemDark, setSystemDark] = useState(false);

  useLayoutEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey) ?? localStorage.getItem('amie.map.appearance');
      if (saved === 'light' || saved === 'dark' || saved === 'system') setAppearance(saved);
    } catch {}
    const preference = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setSystemDark(preference.matches);
    update();
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);

  const dark = appearance === 'dark' || (appearance === 'system' && systemDark);
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = dark ? 'dark' : 'light';
    return () => { delete root.dataset.theme; };
  }, [dark]);

  function saveAppearance(value: Appearance) {
    setAppearance(value);
    try { localStorage.setItem(storageKey, value); } catch {}
  }

  return {appearance, saveAppearance, dark};
}

export function AppearanceSettings({appearance, onChange}: {appearance: Appearance; onChange: (value: Appearance) => void}) {
  return <fieldset className="appearance-setting">
    <legend>Appearance</legend>
    <div className="appearance-options">
      {choices.map(({value, label}) => <label key={value}>
        <input type="radio" name="appearance" value={value} checked={appearance === value} onChange={() => onChange(value)}/>
        <span>{label}</span>
      </label>)}
    </div>
  </fieldset>;
}
