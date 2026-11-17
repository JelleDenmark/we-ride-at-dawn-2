import { mount } from 'svelte';
import { RULES } from '@wrad/core';

// Roster v3 branch: VITE_COMBAT=bg builds the app on Battlegrounds-style combat
// for review. Unset keeps the live queue combat.
if (import.meta.env.VITE_COMBAT === 'bg') RULES.combat = 'bg';
import App from './App.svelte';
import './app.css';

mount(App, { target: document.getElementById('app')! });
