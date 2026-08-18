# Floor picker — Apartment Ana

Pick a floor from the 105 samples in `../Floors/` and see it laid into the two
reference rooms.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static bundle in dist/
```

## What it does

- **Two rooms** — living room and kitchen, switched from the header.
- **105 floors grouped by type** — herringbone, parquet blocks, diagonal parquet,
  versailles panels, planks, laminate planks, and flat wood-grain samples.
  Groups collapse; a dark/medium/light filter narrows the list.
- **Board size** slider, because a texture that reads well in one room is often
  the wrong scale in the other.
- **Hold to see original** to compare against the current floor.

## How the preview works

Each floor is composited into the photo as

```
out = texture(H⁻¹·p) · shading(p)      inside the floor mask
```

- `H` is a homography mapping a square of texture onto the floor plane, so boards
  converge with the room's perspective. It comes from four points per room
  (`plane` in `src/roomConfig.js`), tuned by eye against the photo.
- `shading` is the photo's **own luminance**, normalised so the floor averages 1.0
  and clamped. This is what makes it look laid rather than pasted: the room's
  shadows, the contact darkening under the sofa and the highlight near the window
  all carry over onto the new boards.
- The **floor mask** is a hand-traced polygon per room (`outer`) minus large
  objects standing on the floor (`holes` — in practice the living-room rug).

Thin objects — the armchair legs, the stacked stools in the kitchen — need no
holes. They are dark, so the shading pass reproduces them on top of the new floor
automatically. Only large mid-tone objects like the rug have to be cut out.

## Accuracy

It is a preview, not a render. Known limits:

- Room lighting is reused, so a dark floor still reflects light like the pale one
  it replaced — dark options look slightly brighter than they would in reality.
- The floor polygons are traced by hand and are a pixel or two loose in places,
  most visibly along the sofa's base.
- The photos have some lens distortion, so a single homography can't keep the
  boards perfectly straight across the whole floor.

## Layout

```
src/roomConfig.js   per-room polygons, floor plane, tiling
src/render.js       homography, mask, shading, compositor
src/App.jsx         UI
public/floors.json  generated from ../Floors/INDEX.csv
public/textures/    512px tiles used for compositing
public/thumbs/      200px swatches for the sidebar
```
# flor-tester
