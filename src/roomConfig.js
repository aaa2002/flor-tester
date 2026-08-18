// Room geometry, all coordinates in % of the photo's width/height so they survive resizing.
//
// `outer`  – the visible floor, traced along the walls, sofa front, cabinet plinth, etc.
// `holes`  – large objects standing on the floor that must NOT be repainted (the rug).
//            Thin things (chair legs, stool legs) need no hole: the shading pass keeps them.
// `plane`  – four points that receive a square patch of texture, ordered
//            far-left, far-right, near-right, near-left. Tuned by eye against the photo.
// `repeat` – how many times that square tiles.

export const ROOMS = {
  living: {
    id: 'living',
    label: 'Living room',
    image: 'rooms/living.jpg',
    outer: [
      [0, 100], [0, 77.5], [8, 74.5], [14, 73.5], [22, 72], [32, 69], [40, 65],
      [44, 63], [48, 58.5], [53, 54.5], [62, 52.5], [72, 52.5], [78, 55.5],
      [85, 64.5], [90, 74.5], [95, 86], [99, 96], [100, 100],
    ],
    holes: [
      [[40, 58.5], [74, 56.5], [78, 62], [81, 68], [83.5, 76], [86.5, 84],
       [89, 90], [92.5, 102], [55, 102], [50, 98], [40, 95], [30, 91], [19, 86]],
    ],
    plane: [[26, 60], [82, 56], [126, 104], [-30, 110]],
    repeat: 3.0,
    shading: { lo: 0.25, hi: 1.22, strength: 0.9 },
  },

  kitchen: {
    id: 'kitchen',
    label: 'Kitchen',
    image: 'rooms/kitchen.jpg',
    outer: [
      [0, 100], [0, 81], [12, 78], [22, 76], [30, 72], [42, 69.5],
      [50, 78], [60, 88], [67, 100],
    ],
    holes: [],
    plane: [[24, 72], [46, 69], [78, 104], [-22, 108]],
    repeat: 2.2,
    shading: { lo: 0.25, hi: 1.22, strength: 0.9 },
  },
};

export const ROOM_LIST = [ROOMS.living, ROOMS.kitchen];
