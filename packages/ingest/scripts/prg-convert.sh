#!/usr/bin/env bash
set -euo pipefail

GDAL_IMAGE="ghcr.io/osgeo/gdal:alpine-small-3.13.3@sha256:58e21a794e3e49c2882a078cf39625aa8d1f86188e0273f74156e9f3f3cd0253"

LAYERS=(A01_Granice_wojewodztw A02_Granice_powiatow A03_Granice_gmin)
FIELDS="JPT_KOD_JE,JPT_SJR_KO,JPT_NAZWA_,JPT_POWIER,IIP_PRZEST,IIP_IDENTY,REGON"

input="${1:?Usage: pnpm ingest:prg:convert <folder with the PRG shapefiles, e.g. data/raw/prg/2026-10-23>}"
input="${input%/}"
release="$(basename "$input")"
output="data/work/prg/$release"

for layer in "${LAYERS[@]}"; do
  if [[ ! -f "$input/$layer.shp" ]]; then
    echo "Missing $input/$layer.shp" >&2
    exit 1
  fi
done

mkdir -p "$output"

for layer in "${LAYERS[@]}"; do
  rm -f "$output/$layer.geojsonl"
  echo "Converting $layer"
  docker run --rm --network none --user "$(id -u):$(id -g)" \
    -v "$(pwd)/$input:/in:ro" -v "$(pwd)/$output:/out" \
    "$GDAL_IMAGE" \
    ogr2ogr -f GeoJSONSeq "/out/$layer.geojsonl" "/in/$layer.shp" \
    -t_srs EPSG:4326 -dim XY -lco COORDINATE_PRECISION=7 -select "$FIELDS"
done

echo "Done: $output"
wc -l "$output"/*.geojsonl
