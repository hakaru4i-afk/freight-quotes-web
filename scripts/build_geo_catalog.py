#!/usr/bin/env python3
"""Build offline, separately licensed, exact-name search shards from public data."""
import argparse
import gzip
import hashlib
import json
import math
import os
from pathlib import Path
import sqlite3
import subprocess
import tempfile
import unicodedata
import urllib.request
import zipfile

COUNTRIES = {
    "BY": "europe/belarus", "RU": "russia", "KZ": "asia/kazakhstan",
    "MN": "asia/mongolia", "CN": "asia/china",
}
GN = "https://download.geonames.org/export/dump/"
OSM = "https://download.geofabrik.de/"
LANGS = {"ru", "en", "zh", "zh-Hans", "zh-Hant", "zh-CN"}
FACILITIES = {"RSTN": "rail_station", "RSTP": "rail_halt", "PRT": "terminal",
              "PSTB": "terminal", "PSTC": "terminal"}
FILTERS = [
    "nwr/railway=station,halt,border_control", "nwr/building=train_station",
    "nwr/barrier=border_control", "nwr/amenity=customs",
    "nwr/boundary=border_control", "nwr/harbour=yes",
    "nwr/landuse=port", "nwr/industrial=port", "nwr/seamark:type=harbour",
]

def normalize(value):
    return unicodedata.normalize("NFKC", str(value)).lower().strip()

def shard(value):
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:2]

def digest(path):
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()

def download(url, path):
    subprocess.run(["curl", "--fail", "--location", "--retry", "3",
                    "--connect-timeout", "30", "--output", str(path), url], check=True)
    if not path.stat().st_size:
        raise RuntimeError("Empty source: " + url)
    return {"url": url, "bytes": path.stat().st_size, "sha256": digest(path)}

def packed(obj):
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":"), allow_nan=False)

class Index:
    def __init__(self, tmp):
        self.db = sqlite3.connect(tmp / "catalog.sqlite")
        self.db.executescript("""
            PRAGMA journal_mode=OFF;
            PRAGMA synchronous=OFF;
            CREATE TABLE records(id TEXT PRIMARY KEY, data TEXT NOT NULL);
            CREATE TABLE aliases(shard TEXT NOT NULL, key TEXT NOT NULL,
              id TEXT NOT NULL, lang TEXT NOT NULL, typ TEXT NOT NULL,
              PRIMARY KEY(shard,key,id,lang,typ)) WITHOUT ROWID;
        """)

    def record(self, item):
        self.db.execute("INSERT OR IGNORE INTO records VALUES (?,?)",
                        (item["id"], packed(item)))

    def alias(self, source_id, value, lang="und", typ="name"):
        key = normalize(value)
        if not key or len(key) > 240:
            return
        self.db.execute("""INSERT OR IGNORE INTO aliases
            SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM records WHERE id=?)""",
            (shard(key), key, source_id, lang, typ, source_id))

    def emit(self, out):
        self.db.commit()
        out.mkdir(parents=True, exist_ok=True)
        objects = self.db.execute("SELECT count(*) FROM records").fetchone()[0]
        aliases = self.db.execute("SELECT count(*) FROM aliases").fetchone()[0]
        if objects <= 0 or aliases <= 0:
            raise RuntimeError("No catalog rows")
        files = {}
        for prefix, in self.db.execute("SELECT DISTINCT shard FROM aliases ORDER BY shard"):
            path = out / (prefix + ".jsonl.gz")
            with gzip.GzipFile(filename=str(path), mode="wb", mtime=0, compresslevel=6) as f:
                rows = self.db.execute("""SELECT a.key,r.data,a.lang,a.typ
                     FROM aliases a JOIN records r ON r.id=a.id
                     WHERE a.shard=? ORDER BY a.key,a.id,a.lang,a.typ""", (prefix,))
                for key, data, lang, typ in rows:
                    f.write((packed([key, json.loads(data), lang, typ]) + "\n").encode())
            files[path.name] = {"bytes": path.stat().st_size, "sha256": digest(path)}
        self.db.close()
        return {"objects": objects, "aliases": aliases, "shards": files}

def lines_from_zip(path, expected=None):
    with zipfile.ZipFile(path) as z:
        names = [n for n in z.namelist() if n.lower().endswith(".txt") and
                 "readme" not in n.lower()]
        if expected and expected in names:
            name = expected
        elif len(names) == 1:
            name = names[0]
        else:
            raise RuntimeError("Unexpected archive layout: " + str(names[:10]))
        with z.open(name) as f:
            for line in f:
                yield line.decode("utf-8").rstrip("\r\n").split("\t")

def geonames(cc, tmp, index):
    raw = tmp / "country.zip"
    sources = [download(GN + cc + ".zip", raw)]
    for r in lines_from_zip(raw, cc + ".txt"):
        if len(r) < 19 or r[8] != cc:
            continue
        fc, code = r[6:8]
        if fc == "P":
            if code in {"PPLH", "PPLQ", "PPLW"}:
                continue
            kind = "settlement"
            precision = "settlement"
        elif code in FACILITIES:
            kind, precision = FACILITIES[code], "facility"
        else:
            continue
        lat, lon = float(r[4]), float(r[5])
        if not (math.isfinite(lat) and math.isfinite(lon) and -90 <= lat <= 90 and -180 <= lon <= 180):
            continue
        item = {"id": r[0], "country": cc, "name": r[1], "lat": lat, "lon": lon,
                "kind": kind, "precision": precision, "feature": code,
                "updated": r[18], "verified": False}
        index.record(item)
        index.alias(r[0], r[1])
        index.alias(r[0], r[2], "und", "transliteration")
    index.db.commit()
    raw.unlink()
    alt = tmp / "alt.zip"
    sources.append(download(GN + "alternatenames/" + cc + ".zip", alt))
    for r in lines_from_zip(alt):
        if len(r) < 4 or not r[3]:
            continue
        lang = r[2]
        if len(r) > 7 and r[7] == "1":
            continue
        if lang in LANGS:
            index.alias(r[1], r[3], "zh" if lang.startswith("zh") else lang)
        elif lang in {"abbr", "unlc"}:
            index.alias(r[1], r[3], "und", "code")
    return sources

def coordinates(value):
    if not isinstance(value, list):
        return
    if len(value) >= 2 and all(isinstance(v, (int, float)) for v in value[:2]):
        yield value[:2]
    else:
        for child in value:
            yield from coordinates(child)

def osm_kind(p):
    if p.get("railway") == "border_control":
        return "rail_border"
    if p.get("barrier") == "border_control" or p.get("boundary") == "border_control" or p.get("amenity") == "customs":
        if p.get("railway") == "rail":
            return "rail_border"
        if p.get("highway"):
            return "road_border"
        return "terminal"
    if p.get("railway") in {"station", "halt"} or p.get("building") == "train_station":
        if p.get("station") in {"subway", "light_rail", "tram", "monorail"}:
            return None
        return "rail_halt" if p.get("railway") == "halt" else "rail_station"
    if p.get("harbour") == "yes" or p.get("landuse") == "port" or p.get("industrial") == "port" or p.get("seamark:type") == "harbour":
        return "terminal"
    return None

def osm(cc, tmp, index):
    pbf = tmp / "country.osm.pbf"
    url = OSM + COUNTRIES[cc] + "-latest.osm.pbf"
    sources = [download(url, pbf)]
    subset = tmp / "transport.osm.pbf"
    subprocess.run(["osmium", "tags-filter", str(pbf), *FILTERS,
                    "-o", str(subset), "--overwrite"], check=True)
    pbf.unlink()
    features = tmp / "transport.geojsonseq"
    subprocess.run(["osmium", "export", str(subset), "-a", "type,id",
                    "-i", "sparse_file_array", "-f", "geojsonseq",
                    "-x", "print_record_separator=false",
                    "-o", str(features), "--overwrite"], check=True, cwd=tmp)
    subset.unlink()
    code_keys = ("esr:user","ref:esr","ref:ESR","express:code","uic_ref","ref:UICS",
                 "railway:ref","ref:cr","ref:CR","ref","unlocode","ref:UN/LOCODE")
    with features.open(encoding="utf-8") as f:
        for line in f:
            obj = json.loads(line.lstrip("\x1e"))
            p = obj.get("properties") or {}
            typ, oid = p.get("@type"), p.get("@id")
            kind = osm_kind(p)
            if not kind or typ not in {"node","way","relation"} or oid is None:
                continue
            names = [(p.get("name"), "und")] + [(p.get("name:" + lang), lang) for lang in ("ru","en","zh")]
            codes = [(k,p.get(k)) for k in code_keys if p.get(k)]
            name = next((str(x) for x, _ in names if x), None) or next((str(v) for _,v in codes),None)
            if not name:
                continue
            g = obj.get("geometry") or {}
            points = list(coordinates(g.get("coordinates")))
            if not points:
                continue
            xs, ys = zip(*points)
            if max(xs)-min(xs) > 2 or max(ys)-min(ys) > 2:
                continue
            lon, lat = (min(xs)+max(xs))/2, (min(ys)+max(ys))/2
            if not (math.isfinite(lat) and math.isfinite(lon) and -90 <= lat <= 90 and -180 <= lon <= 180):
                continue
            sid = str(typ) + "/" + str(oid)
            item = {"id": sid,"country":cc,"name":name,"lat":lat,"lon":lon,
                    "kind":kind,"precision":"facility","verified":False,
                    "geometry": "point" if g.get("type") == "Point" else "approximate_bbox_center"}
            index.record(item)
            for value,lang in names:
                if value: index.alias(sid,value,lang)
            for value in str(p.get("alt_name") or "").split(";"):
                if value: index.alias(sid,value)
            for tag,value in codes:
                for code in str(value).split(";"):
                    index.alias(sid,code,"und","code")
                    index.alias(sid,tag + " " + code,"und","code")
    return sources

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", required=True, choices=("geonames","osm"))
    ap.add_argument("--out", type=Path, required=True)
    args = ap.parse_args()
    root = args.out.resolve()
    root.mkdir(parents=True,exist_ok=True)
    meta = {"schema":1,"source":args.source,"countries":{},
            "shard_rule":"sha256(NFKC(name).lower().strip())[:2]",
            "license":"CC BY 4.0; GeoNames" if args.source=="geonames" else "ODbL 1.0; OpenStreetMap contributors; extracts by Geofabrik",
            "attribution":"https://www.geonames.org/" if args.source=="geonames" else "https://www.openstreetmap.org/copyright",
            "notice":"Public source data only. Country is source extract. Not authoritative station-code confirmation; no exact cargo location inferred."}
    for cc in COUNTRIES:
        with tempfile.TemporaryDirectory() as d:
            tmp=Path(d)
            index=Index(tmp)
            sources=(geonames if args.source=="geonames" else osm)(cc,tmp,index)
            result=index.emit(root/cc)
            result["downloads"]=sources
            meta["countries"][cc]=result
            print(cc, result["objects"],result["aliases"],flush=True)
    if set(meta["countries"]) != set(COUNTRIES):
        raise RuntimeError("Incomplete countries")
    meta["total_bytes"]=sum(f.stat().st_size for f in root.rglob("*.gz"))
    if meta["total_bytes"] > 750*1024*1024 or any(f.stat().st_size>90*1024*1024 for f in root.rglob("*.gz")):
        raise RuntimeError("Catalog storage budget exceeded; refuse to publish")
    (root/"manifest.json").write_text(json.dumps(meta,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    (root/"ATTRIBUTION.txt").write_text(meta["license"]+"\n"+meta["attribution"]+"\n"+meta["notice"]+"\n",encoding="utf-8")

if __name__=="__main__":
    main()
