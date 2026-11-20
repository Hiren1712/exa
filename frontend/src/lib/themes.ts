export const COLOR_THEMES = [
  {
    id: 'classic',
    label: 'Xanh EXA',
    description: 'Tươi sáng và quen thuộc',
    swatches: ['#2563eb', '#06b6d4', '#8b5cf6'],
  },
  {
    id: 'ocean',
    label: 'Đại dương',
    description: 'Mát dịu với sắc xanh biển',
    swatches: ['#0e7490', '#06b6d4', '#0f766e'],
  },
  {
    id: 'forest',
    label: 'Rừng xanh',
    description: 'Tự nhiên với sắc xanh lá',
    swatches: ['#15803d', '#10b981', '#84cc16'],
  },
  {
    id: 'violet',
    label: 'Tím mộng mơ',
    description: 'Thanh lịch với sắc tím nổi bật',
    swatches: ['#6d28d9', '#a855f7', '#ec4899'],
  },
  {
    id: 'rose',
    label: 'Hồng đào',
    description: 'Ấm áp với sắc hồng mềm mại',
    swatches: ['#be123c', '#fb7185', '#f97316'],
  },
  {
    id: 'sunset',
    label: 'Hoàng hôn',
    description: 'Rực rỡ với sắc cam và vàng',
    swatches: ['#c2410c', '#f59e0b', '#ec4899'],
  },
  {
    id: 'graphite',
    label: 'Than chì',
    description: 'Tối giản với điểm nhấn xanh',
    swatches: ['#475569', '#64748b', '#0ea5e9'],
  },
] as const;

export type ColorTheme = (typeof COLOR_THEMES)[number]['id'];

export function isColorTheme(value: string | null): value is ColorTheme {
  return COLOR_THEMES.some((theme) => theme.id === value);
}
