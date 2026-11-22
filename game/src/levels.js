// The three jobs of one night at the Marlowe Museum.
// The playfield is 1280 x 800 with a 64px HUD strip at the top, so every
// level lives in y = 64..800. Walls are axis-aligned rectangles; guards walk
// waypoint loops; cameras sweep; lasers blink; shadow pools shrink the
// distance at which anyone can spot Wren.
export const PLAY = { x: 0, y: 64, w: 1280, h: 736 };

export function buildLevels() {
  return [
    {
      id: 1,
      numeral: 'I',
      name: 'The Gallery',
      briefing: 'Lift $8,000 of art. Four paintings, two guards, one camera. Slip out the service door.',
      target: 8000,
      entrance: { x: 70, y: 730 },
      exit: { x: 1150, y: 720, w: 90, h: 60, label: 'SERVICE DOOR' },
      walls: [
        { x: 300, y: 200, w: 24, h: 300 },
        { x: 640, y: 120, w: 24, h: 280 },
        { x: 900, y: 340, w: 24, h: 300 },
        { x: 420, y: 520, w: 360, h: 24 },
        { x: 150, y: 120, w: 240, h: 24 },
        { x: 980, y: 120, w: 200, h: 24 },
      ],
      loot: [
        { x: 180, y: 160, value: 2000, label: 'Portrait of a Duchess', kind: 'painting' },
        { x: 560, y: 180, value: 2000, label: 'Velvet Madonna', kind: 'painting' },
        { x: 820, y: 640, value: 2000, label: 'The Gilded Hare', kind: 'painting' },
        { x: 1120, y: 220, value: 2000, label: 'Midnight in Marlowe', kind: 'painting' },
      ],
      guards: [
        { path: [[200, 640], [200, 300], [520, 300], [520, 640]], speed: 55, pause: 1.2 },
        { path: [[760, 180], [1120, 180], [1120, 620], [760, 620]], speed: 60, pause: 1.0 },
      ],
      cameras: [
        { x: 640, y: 92, base: Math.PI / 2, sweep: 0.9, period: 6, range: 250 },
      ],
      lasers: [],
      shadows: [
        { x: 120, y: 700, r: 70 },
        { x: 700, y: 430, r: 80 },
        { x: 1180, y: 640, r: 70 },
      ],
      terminal: null,
      vault: null,
      diamond: null,
      heli: null,
    },
    {
      id: 2,
      numeral: 'II',
      name: 'The Vault Hall',
      briefing: 'Crack the vault — hold E for 4 seconds — and dodge the blinking laser grid. $15,000 inside.',
      target: 15000,
      entrance: { x: 70, y: 730 },
      exit: { x: 1150, y: 720, w: 90, h: 60, label: 'SERVICE DOOR' },
      walls: [
        { x: 200, y: 180, w: 24, h: 220 },
        { x: 1056, y: 180, w: 24, h: 220 },
        { x: 520, y: 560, w: 240, h: 24 },
        { x: 520, y: 120, w: 240, h: 24 },
      ],
      loot: [
        { x: 250, y: 180, value: 1000, label: 'Gold bars', kind: 'gold' },
        { x: 1030, y: 180, value: 1000, label: 'Jade figurine', kind: 'gold' },
      ],
      vault: { x: 640, y: 150, value: 13000, label: 'THE MARLOWE VAULT' },
      guards: [
        { path: [[180, 640], [180, 300], [480, 300], [480, 640]], speed: 58, pause: 1.0 },
        { path: [[800, 640], [800, 300], [1100, 300], [1100, 640]], speed: 58, pause: 1.0 },
        { path: [[500, 480], [780, 480]], speed: 70, pause: 0.6 },
      ],
      cameras: [
        { x: 640, y: 92, base: Math.PI / 2, sweep: 0.7, period: 5, range: 260 },
        { x: 320, y: 92, base: Math.PI / 2, sweep: 1.1, period: 7, range: 230 },
      ],
      // The laser grid: three beams across the hall, 120px apart, so the
      // gap between two beams is a real waiting place — a thief can stand
      // mid-gap, clear of both lines, and watch the rhythm. They blink
      // on a shared rhythm with a short beat each cycle when all three
      // are dark. Cross one beam at a time, wait out the lit beats.
      lasers: [
        { x1: 300, y1: 280, x2: 980, y2: 280, period: 3.0, phase: 0.0, onFrac: 0.45 },
        { x1: 300, y1: 400, x2: 980, y2: 400, period: 3.0, phase: 0.4, onFrac: 0.45 },
        { x1: 300, y1: 520, x2: 980, y2: 520, period: 3.0, phase: 0.8, onFrac: 0.45 },
      ],
      shadows: [
        { x: 120, y: 700, r: 70 },
        { x: 640, y: 640, r: 85 },
        { x: 1180, y: 640, r: 70 },
        { x: 420, y: 340, r: 55 },
        { x: 860, y: 460, r: 55 },
      ],
      terminal: { x: 120, y: 700, label: 'CAMERA TERMINAL' },
      diamond: null,
      heli: null,
    },
    {
      id: 3,
      numeral: 'III',
      name: 'The Rooftop Getaway',
      briefing: 'Steal the Marlowe Diamond from its pedestal, then reach the helicopter. $18,000. Do not look down.',
      target: 18000,
      entrance: { x: 70, y: 730 },
      exit: null,
      walls: [
        { x: 300, y: 200, w: 24, h: 260 },
        { x: 956, y: 300, w: 24, h: 260 },
        { x: 480, y: 620, w: 320, h: 24 },
      ],
      loot: [],
      diamond: { x: 640, y: 380, value: 18000, label: 'THE MARLOWE DIAMOND' },
      heli: { x: 1120, y: 150, r: 74, label: 'HELICOPTER' },
      guards: [
        { path: [[200, 640], [200, 280], [460, 280], [460, 640]], speed: 62, pause: 0.9 },
        { path: [[820, 640], [820, 280], [1100, 280], [1100, 640]], speed: 62, pause: 0.9 },
        { path: [[480, 180], [800, 180]], speed: 72, pause: 0.5 },
      ],
      cameras: [
        { x: 640, y: 92, base: Math.PI / 2, sweep: 1.0, period: 5, range: 260 },
      ],
      lasers: [
        { x1: 560, y1: 300, x2: 560, y2: 520, period: 2.6, phase: 0.0, onFrac: 0.5 },
        { x1: 720, y1: 300, x2: 720, y2: 520, period: 2.6, phase: 1.3, onFrac: 0.5 },
      ],
      shadows: [
        { x: 120, y: 700, r: 70 },
        { x: 640, y: 640, r: 80 },
        { x: 1000, y: 560, r: 70 },
      ],
      terminal: { x: 120, y: 700, label: 'CAMERA TERMINAL' },
      vault: null,
    },
  ];
}

// A level's loot that actually pays: job III's placeholder row is filtered out.
export function payableLoot(level) {
  return level.loot.filter((l) => l.value > 0);
}
