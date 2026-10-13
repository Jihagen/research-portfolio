#!/usr/bin/env sh
set -eu

root="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
target="$root/dist/data/homonym"
mkdir -p "$target"

cat "$root/archives/homonym/garden_path_landscapes.json.gz.part00" \
    "$root/archives/homonym/garden_path_landscapes.json.gz.part01" \
  | gzip -dc > "$target/garden_path_landscapes.json"

gzip -dc "$root/archives/homonym/geometry_by_layer.json.gz" \
  > "$target/geometry_by_layer.json"

echo "Restored homonym geometry exports to $target"
