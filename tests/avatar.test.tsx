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
