(function (root) {
  'use strict';
  const rows = [
    '########################',
    '#...........#..........#',
    '#...........#..........#',
    '#...........#..........#',
    '#...........#..........#',
    '#...........#..........#',
    '#...........#..........#',
    '#...........#..........#',
    '###########d##d#########',
    '#.........#.....#......#',
    '#.........#.....#......#',
    '#.........#.....#......#',
    '#.........d.....d......#',
    '#.........#.....#......#',
    '#.........#.....#......#',
    '#############e##########',
  ];

  const rooms = [
    { id: 'work', name: '업무실', x1: 1, y1: 1, x2: 11, y2: 7, color: '#C3C3BE', shade: '#ACACA6' },
    { id: 'meeting', name: '회의실', x1: 13, y1: 1, x2: 22, y2: 7, color: '#B2BDC9', shade: '#9BA7B5' },
    { id: 'break', name: '휴게실', x1: 1, y1: 9, x2: 9, y2: 14, color: '#B7C3B2', shade: '#A0AD9B' },
    { id: 'lobby', name: '입구 · 안내 데스크', x1: 11, y1: 9, x2: 15, y2: 14, color: '#D0C6AF', shade: '#B9AE96' },
    { id: 'archive', name: '자료보관함', x1: 17, y1: 9, x2: 22, y2: 14, color: '#C4B6BE', shade: '#AE9FA8' },
  ];

  const doors = [
    { x: 11, y: 8, a: 'work', b: 'lobby' },
    { x: 14, y: 8, a: 'meeting', b: 'lobby' },
    { x: 10, y: 12, a: 'break', b: 'lobby' },
    { x: 16, y: 12, a: 'lobby', b: 'archive' },
  ];

  const deskOwners = ['teacher', 'critic', 'blog-editor', null, 'planner', 'scenario-writer', 'designer', 'developer', 'organizer'];
  const deskSpots = [
    [3, 3, 'down', 0], [4, 3, 'down', 1], [3, 4, 'up', 0], [4, 4, 'up', 1],
    [8, 3, 'down', 0], [9, 3, 'down', 1], [8, 4, 'up', 0], [9, 4, 'up', 1],
    [17, 14, 'down'],
  ];
  const SPRITE = {
    desk: 'desk', chair: 'chair', podUp: 'desk_pod_up', podDown: 'desk_pod_down', toriDesk: 'reception', shelf: 'bookshelf', table: 'meetingtable', sofa: 'sofa', plant: 'plant',
    sidetable: 'sidetable', coffee: 'coffee', whiteboard: 'whiteboard', filebox: 'filebox',
    rug: 'rug', entrancemat: 'entrancemat', exitdoor: 'exitdoor', door_ns: 'door_ns', door_we: 'door_we',
    clock: 'clock', window: 'window', picture: 'picture',
    roundtable: 'roundtable', cafechair: 'cafechair', watercooler: 'watercooler', acornbasket: 'acornbasket',
    tray: { empty: 'tray_empty', few: 'tray_few', many: 'tray_many', unknown: 'tray_empty' },
    paper: ['paperpile_1', 'paperpile_2', 'paperpile_3'],
  };
  const objects = [];
  const POD_PAPER = { up: [[-1, 2], [-8, 2]], down: [[-1, -3], [-8, -3]] };
  deskSpots.forEach((p, i) => {
    const front = p[2] === 'down';
    const d = { type: 'desk', x: p[0], y: p[1], w: 1, h: 1, owner: deskOwners[i], chair: { x: p[0], y: p[1] + (front ? -1 : 1) }, chairSeparate: front };
    if (p[3] != null) Object.assign(d, { sprite: front ? SPRITE.podDown : SPRITE.podUp, frame: p[3], paperDx: POD_PAPER[p[2]][p[3]][0], paperDy: POD_PAPER[p[2]][p[3]][1] });
    objects.push(d);
    if (front) objects.push({ type: 'chair', x: p[0], y: p[1] - 1, w: 1, h: 1, block: false });
  });
  objects.push({ type: 'plant', x: 1, y: 7, w: 1, h: 1 });
  objects.push({ type: 'clock', x: 6, y: 0, w: 1, h: 1, wall: true });
  objects.push({ type: 'table', x: 16, y: 3, w: 4, h: 2 });
  objects.push({ type: 'whiteboard', x: 17, y: 1, w: 2, h: 1 });
  objects.push({ type: 'window', x: 20, y: 0, w: 2, h: 1, wall: true });
  objects.push({ type: 'plant', x: 22, y: 1, w: 1, h: 1 });
  objects.push({ type: 'sofa', x: 5, y: 9, w: 2, h: 1 });
  objects.push({ type: 'plant', x: 9, y: 9, w: 1, h: 1 });
  objects.push({ type: 'sidetable', x: 4, y: 9, w: 1, h: 1 });
  objects.push({ type: 'acornbasket', x: 4, y: 9, w: 1, h: 1, block: false, dx: -2, dy: -7 });
  objects.push({ type: 'coffee', x: 8, y: 9, w: 1, h: 1 });
  objects.push({ type: 'rug', x: 4, y: 10, w: 3, h: 2, floor: true });
  objects.push({ type: 'picture', x: 2, y: 8, w: 1, h: 1, wall: true });
  objects.push({ type: 'watercooler', x: 1, y: 9, w: 1, h: 1 });
  objects.push({ type: 'roundtable', x: 2, y: 12, w: 2, h: 2, blockAt: [1, 12], block: ['.xx.', 'xxxx', '.xx.'] });
  [[2, 12, 0, 40, 188], [1, 13, 3, 19, 202], [4, 13, 2, 61, 202], [2, 14, 1, 40, 216]].forEach(([x, y, frame, cx, cy]) =>
    objects.push({ type: 'cafechair', x, y, w: 1, h: 1, block: false, frame, dx: cx - x * 16, dy: cy - (y * 16) }));
  objects.push({ type: 'toriDesk', x: 12, y: 11, w: 2, h: 1, owner: '토리' });
  objects.push({ type: 'tray', x: 14, y: 11, w: 1, h: 1 });
  objects.push({ type: 'entrancemat', x: 13, y: 14, w: 1, h: 1, floor: true });
  objects.push({ type: 'exitdoor', x: 13, y: 15, w: 1, h: 1, floor: true });
  objects.push({ type: 'plant', x: 15, y: 14, w: 1, h: 1 });
  objects.push({ type: 'clock', x: 12, y: 8, w: 1, h: 1, wall: true });
  objects.push({ type: 'shelf', x: 18, y: 9, w: 4, h: 1 });
  objects.push({ type: 'filebox', x: 17, y: 9, w: 1, h: 1 });
  objects.push({ type: 'filebox', sprite: 'filebox_blue', x: 22, y: 13, w: 1, h: 1 });
  objects.push({ type: 'filebox', sprite: 'filebox_mauve', x: 22, y: 14, w: 1, h: 1 });
  objects.push({ type: 'filebox', sprite: 'filebox_sage', x: 21, y: 14, w: 1, h: 1 });
  objects.push({ type: 'plant', x: 22, y: 9, w: 1, h: 1 });
  doors.forEach((d) => objects.push({ type: rows[d.y][d.x - 1] === '#' && rows[d.y][d.x + 1] === '#' ? 'door_ns' : 'door_we', x: d.x, y: d.y, w: 1, h: 1, floor: true }));
  objects.forEach((o) => {
    if (o.floor || o.wall) o.block = false;
    if (!o.sprite && typeof SPRITE[o.type] === 'string') o.sprite = SPRITE[o.type];
    if (o.type === 'tray') o.sprites = SPRITE.tray;
    if (o.type === 'desk') o.paperSprites = SPRITE.paper;
    if (o.chair && SPRITE.chair) o.chairSprite = SPRITE.chair;
  });

  const SOFA_PX = { x: 80, y: 143 };
  const breakSpots = [
    { x: 5, y: 9, px: SOFA_PX.x + 1, py: SOFA_PX.y - 5, pose: 'sit', face: 'down', seat: 'sofa', prefer: ['blog-editor', 'organizer'] },
    { x: 6, y: 9, px: SOFA_PX.x + 15, py: SOFA_PX.y - 5, pose: 'sit', face: 'down', seat: 'sofa', prefer: ['토리', 'planner', 'designer'] },
    { x: 1, y: 13, px: 19, py: 196, pose: 'sit', face: 'right', group: 'T', seat: 'chair' },
    { x: 4, y: 13, px: 61, py: 196, pose: 'sit', face: 'left', group: 'T', seat: 'chair' },
    { x: 2, y: 12, px: 40, py: 182, pose: 'sit', face: 'down', group: 'T', seat: 'chair', avoid: ['scenario-writer'] },
    { x: 2, y: 14, px: 40, py: 210, pose: 'sit', face: 'up', group: 'T', seat: 'chair' },
    { x: 6, y: 13, pose: 'coffee', face: 'down', group: 'B', seat: 'floor' },
    { x: 8, y: 13, pose: 'idle', face: 'down', group: 'B', seat: 'floor' },
    { x: 3, y: 9, pose: 'coffee', face: 'down', seat: 'floor', avoid: ['blog-editor'] },
    { x: 8, y: 10, pose: 'coffee', face: 'down', seat: 'floor' },
    { x: 1, y: 10, pose: 'idle', face: 'down', seat: 'floor' },
  ];
  const SOFA_MID_PX = SOFA_PX.x + 8;
  const meetingSpots = [[16, 2], [19, 2], [16, 5], [19, 5], [14, 4], [21, 4]];
  meetingSpots.forEach((p) => objects.push({ type: 'chair', x: p[0], y: p[1], w: 1, h: 1, block: false, sprite: SPRITE.chair }));

  root.PO_LAYOUT = {
    w: 24, h: 16, tile: 16, rows, rooms, doors, objects, breakSpots, SOFA_MID_PX, meetingSpots, SPRITE,
    toriHome: [13, 10], spawn: [13, 14], spawnFace: 'up',
    keepClear: [[11, 9], [11, 10], [11, 11], [15, 9], [15, 10], [15, 11], [15, 12], [14, 9], [14, 10], [17, 12]],
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PO_LAYOUT;
})(typeof window !== 'undefined' ? window : globalThis);
