import Svg, { Circle, Path } from 'react-native-svg';

// Line icons from the mockup (24×24, stroke 1.7). Add new ones here in the same style.
const ICONS: Record<string, { paths: string[]; circles?: [number, number, number][] }> = {
  home: { paths: ['M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z'] },
  train: { paths: ['M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11'] },
  hist: { paths: ['M4 19.5h16M5.5 15l4.5-5 3.5 3 5-6.5'] },
  gear: { paths: ['M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.8 1.8M16.7 16.7l1.8 1.8M5.5 18.5l1.8-1.8M16.7 7.3l1.8-1.8'], circles: [[12, 12, 3]] },
  bulb: { paths: ['M9.5 18h5M10.5 21h3M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z'] },
  plus: { paths: ['M12 5v14M5 12h14'] },
  minus: { paths: ['M5 12h14'] },
  back: { paths: ['M15 5l-7 7 7 7'] },
  chev: { paths: ['M9.5 6l6 6-6 6'] },
  check: { paths: ['M5.5 12.5l4 4 9-9'] },
  note: { paths: ['M6 4h9l4 4v12H6zM14.5 4v4.5H19M9 13h6M9 16.5h4'] },
  close: { paths: ['M6 6l12 12M18 6 6 18'] },
  up: { paths: ['M5 16 12 9l7 7'] },
  down: { paths: ['M5 8l7 7 7-7'] },
  flat: { paths: ['M5 12h14'] },
  star: { paths: ['M12 4.5l2.3 4.7 5.2.7-3.8 3.6.9 5.1L12 16.2l-4.6 2.4.9-5.1-3.8-3.6 5.2-.7z'] },
  info: { paths: ['M12 11v5M12 8h.01'], circles: [[12, 12, 8.5]] },
  ruler: { paths: ['M4 16 16 4l4 4L8 20zM8 12l2 2M11 9l2 2M14 6l2 2'] },
  moon: { paths: ['M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z'] },
  sun: { paths: ['M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4'], circles: [[12, 12, 4]] },
  trash: { paths: ['M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12'] },
  timer: { paths: ['M12 8v5l3 2M9.5 3h5'], circles: [[12, 13, 7.5]] },
  drag: { paths: ['M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01'] },
  edit: { paths: ['M5 19h4L19 9l-4-4L5 15zM13.5 6.5l4 4'] },
  more: { paths: ['M6 12h.01M12 12h.01M18 12h.01'] },
  download: { paths: ['M12 4v11M7 10.5l5 5 5-5M5 20h14'] },
  upload: { paths: ['M12 20V9M7 13.5l5-5 5 5M5 4h14'] },
  scale: { paths: ['M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM9 9.5a4 4 0 0 1 6 0M12 9.5l1.2-1.8'] },
};

export type IconName = keyof typeof ICONS | string;

export function Icon({ name, size = 20, color, strokeWidth = 1.7 }: { name: IconName; size?: number; color: string; strokeWidth?: number }) {
  const ic = ICONS[name] ?? ICONS.info;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {ic.circles?.map(([cx, cy, r], i) => <Circle key={`c${i}`} cx={cx} cy={cy} r={r} />)}
      {ic.paths.map((d, i) => <Path key={i} d={d} />)}
    </Svg>
  );
}
