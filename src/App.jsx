import { useEffect, useMemo, useRef, useState } from 'react';
import { ROOMS, ROOM_LIST } from './roomConfig';
import { prepareRoom, renderFloor, loadImage, textureData } from './render';
import './App.css';

const TONES = ['dark', 'medium', 'light'];

export default function App() {
  const [floors, setFloors] = useState([]);
  const [roomId, setRoomId] = useState('living');
  const [selected, setSelected] = useState(null);
  const [scale, setScale] = useState(1);
  const [tones, setTones] = useState([]);
  const [collapsed, setCollapsed] = useState({});
  const [compare, setCompare] = useState(false);
  const [room, setRoom] = useState(null);   // prepared room: mask, shading, base pixels

  const canvasRef = useRef(null);
  const texRef = useRef(new Map());         // id -> ImageData cache

  const busy = !room || room.id !== roomId;

  // ---- data ----
  useEffect(() => {
    fetch('floors.json')
      .then((r) => r.json())
      .then((data) => {
        setFloors(data);
        setSelected(data.find((f) => f.group !== 'grain-sample') ?? data[0]);
      });
  }, []);

  // ---- prepare the room whenever it changes ----
  useEffect(() => {
    let alive = true;
    loadImage(ROOMS[roomId].image).then((img) => {
      if (!alive) return;
      setRoom({ ...prepareRoom(img, ROOMS[roomId]), id: roomId });
    });
    return () => { alive = false; };
  }, [roomId]);

  // ---- composite whenever room / floor / scale changes ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (busy || !canvas || !selected) return;
    let alive = true;
    canvas.width = room.w;
    canvas.height = room.h;

    const paint = (texData) => {
      if (!alive) return;
      const ctx = canvas.getContext('2d');
      if (compare) {
        ctx.putImageData(room.baseData, 0, 0);
      } else {
        ctx.putImageData(renderFloor(room, texData, scale), 0, 0);
      }
    };

    const cached = texRef.current.get(selected.id);
    if (cached) {
      paint(cached);
    } else {
      loadImage(selected.texture).then((img) => {
        if (!alive) return;
        const data = textureData(img);
        texRef.current.set(selected.id, data);
        paint(data);
      });
    }
    return () => { alive = false; };
  }, [selected, room, busy, scale, compare]);

  // ---- grouping ----
  const groups = useMemo(() => {
    const visible = tones.length
      ? floors.filter((f) => tones.includes(f.tone))
      : floors;
    const out = [];
    for (const f of visible) {
      let g = out.find((x) => x.key === f.group);
      if (!g) out.push((g = { key: f.group, label: f.groupLabel, items: [] }));
      g.items.push(f);
    }
    return out;
  }, [floors, tones]);

  const toggleTone = (t) =>
    setTones((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));

  return (
    <div className="app">
      <header>
        <div>
          <h1>Floor picker</h1>
          <p className="sub">Apartment Ana &middot; {floors.length} samples</p>
        </div>
        <nav className="rooms">
          {ROOM_LIST.map((r) => (
            <button
              key={r.id}
              className={r.id === roomId ? 'active' : ''}
              onClick={() => setRoomId(r.id)}
            >
              {r.label}
            </button>
          ))}
        </nav>
      </header>

      <main>
        <section className="stage">
          <div className="canvas-wrap">
            <canvas ref={canvasRef} />
            {busy && <div className="loading">Preparing room…</div>}
          </div>

          <div className="controls">
            <button
              className="ghost"
              onMouseDown={() => setCompare(true)}
              onMouseUp={() => setCompare(false)}
              onMouseLeave={() => setCompare(false)}
              onTouchStart={() => setCompare(true)}
              onTouchEnd={() => setCompare(false)}
            >
              Hold to see original
            </button>

            <label className="slider">
              Board size
              <input
                type="range" min="0.5" max="2.5" step="0.05"
                value={2.9 - scale}
                onChange={(e) => setScale(2.9 - Number(e.target.value))}
              />
            </label>
          </div>

          {selected && (
            <div className="detail">
              <img src={selected.thumb} alt="" />
              <div>
                <strong>{selected.name}</strong>
                <span>{selected.groupLabel} &middot; {selected.colour}</span>
                <a href={selected.url} target="_blank" rel="noreferrer">
                  {selected.source} &middot; CC0
                </a>
              </div>
              <span className="chip" style={{ background: selected.hex }} />
            </div>
          )}
        </section>

        <aside>
          <div className="filters">
            {TONES.map((t) => (
              <button
                key={t}
                className={tones.includes(t) ? 'on' : ''}
                onClick={() => toggleTone(t)}
              >
                {t}
              </button>
            ))}
            {tones.length > 0 && (
              <button className="clear" onClick={() => setTones([])}>reset</button>
            )}
          </div>

          <div className="groups">
            {groups.map((g) => (
              <section key={g.key} className="group">
                <button
                  className="group-head"
                  onClick={() =>
                    setCollapsed((c) => ({ ...c, [g.key]: !c[g.key] }))
                  }
                >
                  <span className={`caret ${collapsed[g.key] ? 'shut' : ''}`}>›</span>
                  {g.label}
                  <em>{g.items.length}</em>
                </button>

                {!collapsed[g.key] && (
                  <div className="swatches">
                    {g.items.map((f) => (
                      <button
                        key={f.id}
                        className={`swatch ${selected?.id === f.id ? 'sel' : ''}`}
                        onClick={() => setSelected(f)}
                        title={`${f.name} — ${f.colour}`}
                      >
                        <img src={f.thumb} alt={f.name} loading="lazy" />
                        <span>{f.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        </aside>
      </main>
    </div>
  );
}
