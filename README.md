# Research Portfolio

Interactive research portfolio featuring:

- **Affective Vulnerabilities in Multimodal Language Models** — Julia Jihagen's MSc thesis project
- **Homonym Semantics** — semantic trajectories and contextual disambiguation in language models

## Local preview

Restore the two compressed homonym geometry exports, then serve the static site:

```bash
./scripts/restore-homonym-exports.sh
cd dist
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

The website is published here as a static build. The private hosting configuration is intentionally not included.

## Compressed homonym exports

The two large, losslessly compressed exports are stored under `archives/homonym/` to keep this GitHub mirror portable. The restore script recreates their original paths in `dist/data/homonym/` exactly.
