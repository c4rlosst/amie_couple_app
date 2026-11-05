import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/postcss';
export default defineConfig({root:'pages',base:'/amie_couple_app/',publicDir:'../public',plugins:[react()],css:{postcss:{plugins:[tailwind()]}},build:{outDir:'../dist-pages',emptyOutDir:true}});
