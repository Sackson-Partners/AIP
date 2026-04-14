import React from 'react';
import { render } from '@testing-library/react';
import {
  PlusIcon,
  XIcon,
  DocumentIcon,
  ChartIcon,
  GlobeIcon,
  WarningIcon,
  ChevronIcon,
} from '../icons';

const icons = [
  { name: 'PlusIcon',    Component: PlusIcon    },
  { name: 'XIcon',       Component: XIcon       },
  { name: 'DocumentIcon',Component: DocumentIcon},
  { name: 'ChartIcon',   Component: ChartIcon   },
  { name: 'GlobeIcon',   Component: GlobeIcon   },
  { name: 'WarningIcon', Component: WarningIcon },
  { name: 'ChevronIcon', Component: ChevronIcon },
];

describe('Icon components', () => {
  it.each(icons)('$name renders without errors', ({ Component }) => {
    expect(() => render(<Component />)).not.toThrow();
  });

  it.each(icons)('$name renders an svg element', ({ Component }) => {
    const { container } = render(<Component />);
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it.each(icons)('$name applies className prop', ({ Component }) => {
    const { container } = render(<Component className="w-5 h-5 text-red-500" />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('class')).toContain('w-5 h-5 text-red-500');
  });

  it('exports all 7 icons', () => {
    const exported = [
      PlusIcon, XIcon, DocumentIcon, ChartIcon, GlobeIcon, WarningIcon, ChevronIcon,
    ];
    expect(exported).toHaveLength(7);
    exported.forEach(icon => expect(typeof icon).toBe('function'));
  });
});
