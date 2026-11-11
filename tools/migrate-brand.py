#!/usr/bin/env python3
"""
migrate-brand.py — rebrand "Insane OS" → "Insane OS" across the tree.

Scope (what the rebrand covers): every user-visible string, component name, comment and
doc mention. NOT touched (deliberately — URLs, data paths and internal logic stay):
  • lowercase identifiers/paths: ~/.config/insaneos, /usr/lib/insaneos, insane-*, org.insaneos.*, app-insaneos-*
  • URLs: insaneos.org
  • environment variables: INSANE_*
  • the lowercase JS global object: insane.*
  • generated files: *.bundle.js, code-manifest.json, package-lock.json, assets/icons/*.png
"""
import os, re, sys

REPO = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
SKIP_DIRS = {'node_modules', '.git', 'build', 'mascot'}
SKIP_FILES = {'code-manifest.json', 'package-lock.json'}
EXTS = {'.js', '.jsx', '.json', '.c', '.h', '.md', '.sh', '.py', '.html', '.css', '.mjs', '.txt'}

# order matters: compound identifiers first, then the plain brand word
RULES = [
    ('InsaneGlyph', 'InsaneGlyph'),
    ('InsaneWordmark', 'InsaneWordmark'),
    ('InsaneLogo', 'InsaneLogo'),
    ('InsaneCard', 'InsaneCard'),
    ('InsaneBench', 'InsaneBench'),
    ('InsaneLog', 'InsaneLog'),
    ('InsaneTerminal', 'InsaneTerminal'),
    ('Insane OS', 'Insane OS'),
    ('Insane Flow', 'Insane Flow'),
    ('Insane Classic', 'Insane Classic'),
]

def wanted(path):
    ext = os.path.splitext(path)[1]
    return ext in EXTS

def main():
    changed = touched = 0
    leftovers = {}
    for root, dirs, files in os.walk(REPO):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for name in files:
            if name in SKIP_FILES or not wanted(name):
                continue
            path = os.path.join(root, name)
            try:
                text = open(path, encoding='utf-8').read()
            except (UnicodeDecodeError, PermissionError):
                continue
            new = text
            for old, repl in RULES:
                new = new.replace(old, repl)
            if new != text:
                open(path, 'w', encoding='utf-8').write(new)
                changed += 1
            touched += 1
            # report any remaining brand words for manual review (e.g. standalone "Insane ")
            for m in set(re.findall(r'Insane[A-Za-z]*', new)):
                leftovers.setdefault(m, []).append(os.path.relpath(path, REPO))
    print(f'files touched: {touched}, changed: {changed}')
    print('remaining "Insane*" words (manual review):')
    for word, paths in sorted(leftovers.items()):
        print(f'  {word}: {len(paths)} file(s), e.g. {paths[0]}')

if __name__ == '__main__':
    main()
