#!/usr/bin/env python3
"""wire-motion.py — wires the downloaded live wallpaper video into the desktop:
adds it to settings.motionUser (the user's own motion wallpapers) and selects it for
every display (settings.motion). Runs as the user; edits settings.json only."""
import json

p = '/home/explorearafat/.config/lordos/settings.json'
d = json.load(open(p))
mu = [x for x in (d.get('motionUser') or []) if x.get('id') != 'insane-galaxy']
mu.append({'id': 'insane-galaxy', 'name': 'insane-galaxy.mp4', 'path': '/home/explorearafat/Videos/insane-galaxy.mp4'})
d['motionUser'] = mu
m = d.get('motion') or {}
m['*'] = 'user:insane-galaxy'
d['motion'] = m
json.dump(d, open(p, 'w'), indent=2)
print('   live wallpaper wired (desktop motion -> your video)')
