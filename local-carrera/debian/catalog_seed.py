"""Install public catalogue defaults without replacing user data or newer entries."""
import hashlib
import json
from pathlib import Path
import re
import shutil
import sqlite3
import time


def seed_catalog(root, database, uploads):
    seed = json.loads((root / 'catalog-seed.json').read_text())
    catalog = seed['catalog']
    assert catalog['version'] == 1 and isinstance(catalog['entries'], list)
    # Content-addressed public product pictures only; no personal car/driver photos.
    for filename, checksum in seed['images'].items():
        if not re.fullmatch(r'(?:catalog-(?:200\d{5}|[CH]\d{4}[A-Z]?)-[a-f0-9]{16}\.(jpg|png|webp)|scalextric-c\d{4}-[a-f0-9]{16}\.jpg)', filename):
            raise ValueError('Ungültiger Katalogbildname.')
        source = root / 'catalog-images' / filename
        if hashlib.sha256(source.read_bytes()).hexdigest() != checksum:
            raise ValueError('Katalogbild-Prüfsumme ungültig: ' + filename)
        target = uploads / 'cars' / filename
        target.parent.mkdir(parents=True, exist_ok=True)
        if not target.exists():
            shutil.copyfile(source, target)
    with sqlite3.connect(database, timeout=30) as db:
        db.execute('BEGIN IMMEDIATE')
        now = int(time.time() * 1000)
        row = db.execute('SELECT value FROM Preference WHERE key=?', ('carrera:catalog:v1',)).fetchone()
        current = json.loads(row[0]) if row else {'version': 1, 'entries': []}
        if current.get('version') != 1 or not isinstance(current.get('entries'), list):
            raise ValueError('Vorhandenes Katalogformat wird nicht unterstützt.')
        merged = {e['articleNumber']: e for e in current['entries']}
        added = 0
        for entry in catalog['entries']:
            number = entry['articleNumber']
            if number not in merged:
                merged[number] = entry
                added += 1
        if added or not row:
            current['entries'] = sorted(merged.values(), key=lambda e: e['articleNumber'])
            current.setdefault('updatedAt', catalog['updatedAt'])
            db.execute('INSERT INTO Preference(key,value,updatedAt) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updatedAt=excluded.updatedAt', ('carrera:catalog:v1', json.dumps(current, ensure_ascii=False), now))
        for key, value in seed['tyres'].items():
            if not re.fullmatch(r'carrera:tyres:200\d{5}', key):
                raise ValueError('Ungültiger Reifen-Katalogschlüssel.')
            db.execute('INSERT OR IGNORE INTO Preference(key,value,updatedAt) VALUES(?,?,?)', (key, json.dumps(value, ensure_ascii=False), now))
        # Bind model-specific defaults only to cars already explicitly identified by the owner.
        # Never create personal cars in a fresh installation or guess from a similar model name.
        for car_id, notes in db.execute('SELECT id,notes FROM Car WHERE deletedAt IS NULL'):
            references = re.findall(r'^Artikelnummer laut Besitzer: ([CH]\d{4})\s*$', notes or '', re.M)
            for item in seed['scalextric']:
                if item['ownerReference'] in references:
                    db.execute('INSERT OR IGNORE INTO Preference(key,value,updatedAt) VALUES(?,?,?)', ('car:compatibleTyres:' + car_id, json.dumps(item['assignment'], ensure_ascii=False), now))
