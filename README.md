# STORM

Audiovisual storm installation built with **Three.js**: ocean, mountains, or arctic scenes react to **microphone level** and **webcam pose / crowd detection**, escalating through **CALM → CHARGED → TEMPEST → APOCALYPSE** with rain, 3D lightning, tornadoes, layered audio, and post-processing.

No bundler — static **ES modules** and Three.js from a CDN **import map** in `index.html`.

## Run locally

From this directory:

```bash
python3 -m http.server 8765
```

Open **http://localhost:8765/** (use any free port you like).

Use **http://** (not `file://`) so modules and media load correctly.

## First-time flow in the browser

1. Click the **begin** overlay so the browser allows audio and the mic graph.
2. Allow **microphone** and **camera** when prompted (sound meter, pose, and optional person count need them).
3. Click **“sit back and relax”** to leave the idle lock: calm ambience stays until the storm reaches **CHARGED**, then the main music layer starts and the state machine follows your energy.

After the finale, use the restart overlay to cycle again.

## Environments

Use the top buttons to switch **OCEAN** (water + sky), **MOUNTAINS** (procedural terrain), or **ARCTIC** (ice water + icebergs). The storm logic is the same; only the backdrop changes.

## Keyboard (after activation)

| Key | Action |
|-----|--------|
| **1–4** | Hold to force **CALM / CHARGED / TEMPEST / APOCALYPSE** (debug / rehearsal). Release to return to live inputs. |
| **Space** | Camera shake |
| **F** | Full-screen flash |
| **R** | Toggle 90s rehearsal ramp |
| **P** | Toggle preflight HUD |
| **Ctrl+Shift+R** | Reload the page |

Keys **1–4** are ignored until the demo is activated.

## Tuning

In `main.js`, adjust **`MIC_SENSITIVITY`**, energy thresholds in **`updateStateMachine`**, and **`HIGH_ENERGY_TRIGGER_S`** for how long loud energy must hold before **APOCALYPSE** arms.

## Audio assets

Place (or replace) files under **`audio/`** — see `audioMix.js` for paths (`calm`, `music`, `wind`, `rumble`, `thunder*.wav`).

## Project layout

| Path | Role |
|------|------|
| `index.html` | Shell, import map, UI layers |
| `main.js` | Scene, composer, state machine, inputs |
| `audio.js` / `audioMix.js` | Mic analyser + layered loops and thunder |
| `pose.js` | MediaPipe pose (+ object detector for crowd count) |
| `lightning.js` / `lightning3d.js` | Auto strikes + in-world bolts and lights |
| `rain.js` / `tornado.js` | Particle effects |
| `soundwave.js` | Small waveform HUD |
| `environments/*.js` | Ocean / mountains / arctic setup and updates |

## License

Add a license if you open-source this repo.
