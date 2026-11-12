import { render } from '@testing-library/react';
import { Avatar } from '@/features/person/Avatar';
import type { PersonRec } from '@/lib/clanModel';

const base = {
  id: 'p1',
  fullName: 'Trịnh Văn A',
  gender: 'male',
  isBloodline: true,
  photoUrl: 'data:image/png;base64,iVBORw0KGgo=',
} as unknown as PersonRec;

/** D69: the photo of someone who has died shows in black and white (CSS on `data-deceased`). */
describe('Avatar of the deceased', () => {
  it('marks the photo of a deceased person, so it shows in black and white', () => {
    const { container } = render(<Avatar person={{ ...base, death: { isDeceased: true } } as PersonRec} size={40} />);
    const frame = container.querySelector('span')!;
    expect(frame).toHaveAttribute('data-deceased');
    expect(frame.querySelector('img')).not.toBeNull();
  });

  it('leaves the photo of a living person in colour', () => {
    const { container } = render(<Avatar person={base} size={40} />);
    expect(container.querySelector('span')).not.toHaveAttribute('data-deceased');
  });
});

import { clampCrop, cropBounds } from '@/features/person/PhotoAdjust';
import { validatePersonFields } from '@/lib/validators';

/** D95: where the photo sits in the round portrait. */
describe('photo crop', () => {
  it('draws the photo moved and enlarged about the circle centre, and flat when unadjusted', () => {
    const crop = render(<Avatar person={{ ...base, photoCrop: { zoom: 1.5, x: -0.1, y: 0.05 } } as PersonRec} size={96} />);
    expect(crop.container.querySelector('img')!.style.transform).toBe('translate(-10%, 5%) scale(1.5)');
    const flat = render(<Avatar person={base} size={96} />);
    expect(flat.container.querySelector('img')!.style.transform).toBe('');
    const reset = render(<Avatar person={{ ...base, photoCrop: { zoom: 1, x: 0, y: 0 } } as PersonRec} size={96} />);
    expect(reset.container.querySelector('img')!.style.transform).toBe('');
  });

  it('keeps the photo covering the circle: no room to move unless enlarged or wide', () => {
    // A square photo at zoom 1 fills the circle exactly: nothing to move.
    expect(cropBounds(1, 1)).toEqual({ x: 0, y: 0 });
    // A 3:2 landscape photo has spare width at zoom 1 but none in height.
    expect(cropBounds(1.5, 1)).toEqual({ x: 0.25, y: 0 });
    // A tall photo: spare height only.
    expect(cropBounds(2 / 3, 1)).toEqual({ x: 0, y: 0.25 });
    // Enlarged, there is room both ways.
    expect(cropBounds(1, 2)).toEqual({ x: 0.5, y: 0.5 });
    expect(clampCrop({ zoom: 2, x: 3, y: -3 }, 1)).toEqual({ zoom: 2, x: 0.5, y: -0.5 });
    expect(clampCrop({ zoom: 9, x: 0, y: 0 }, 1).zoom).toBe(4);
    expect(clampCrop({ zoom: 0.2, x: 0.4, y: 0.4 }, 1)).toEqual({ zoom: 1, x: 0, y: 0 });
  });

  it('is accepted when valid and refused when zoom is below 1, a key is missing or an extra one is added', () => {
    const person = { fullName: 'A', gender: 'male', isBloodline: true } as const;
    expect(validatePersonFields({ ...person, photoCrop: { zoom: 1.6, x: -0.1, y: 0.05 } })).toEqual([]);
    expect(validatePersonFields({ ...person, photoCrop: { zoom: 0.5, x: 0, y: 0 } }).length).toBeGreaterThan(0);
    expect(validatePersonFields({ ...person, photoCrop: { zoom: 1.5, x: 0 } as never }).length).toBeGreaterThan(0);
    expect(validatePersonFields({ ...person, photoCrop: { zoom: 1.5, x: 0, y: 0, angle: 3 } as never }).length).toBeGreaterThan(0);
  });
});
