# Build the 3D coverage dashboard — condensed recipe

## Stack
- Three.js (ESM via importmap from unpkg) for the 3D view.
- Python stdlib `http.server` for a local dashboard server (no deps).

## Files
- `floorplan.json` — rooms `{name,x,y,w,d,h}` meters. Template in templates/.
- `survey.json` — RSSI samples `{x,y,rssi,band}` appended by `survey_walk.py`.
- `survey_walk.py` — console prompt per grid point; reads RSSI via `netsh wlan show interfaces` regex `Rssi\s*:\s*(-?\d+)`.
- `server.py` — endpoints: `/api/floorplan`, `/api/coverage`, `/api/devices` (runs lan_sweep.py logic, 60s cache).
- `index.html` — Three.js scene: GridHelper + per-room EdgesGeometry boxes + Sprite labels; IDW RSSI surface as wireframe PlaneGeometry with vertexColors; OrbitControls; device-count card.

## IDW coverage field
```
r(x,y) = Σ(rssi_i / d_i²) / Σ(1 / d_i²),  d_i = hypot(dx,dy) + 0.5
color  = HSL( 0.33 * clamp((rssi+75)/40, 0, 1), 0.85, 0.5 )  # -75→red, -35→green
```
Raise surface y by `(rssi+75)/8`.

## Security
- Render scan data with `textContent` / `replaceChildren`, NEVER `innerHTML` (XSS lint flag).

## CUA / browser pitfalls
- Windows terminal `&` is blocked → use `terminal(background=true)` or Python threading for parallel pings.
- Chrome address-bar typing needs `delivery_mode:"foreground"` (background_unavailable for text_input on Chrome_WidgetWin_1). Let the USER type any router password into the UI; never type secrets.
