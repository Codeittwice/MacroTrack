import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RangePicker } from './index';

describe('RangePicker', () => {
  it('commits the suggested value when the range is touched and supports fine adjustment', () => {
    const onValue = vi.fn();
    render(
      <RangePicker
        value={undefined}
        onValue={onValue}
        min={120}
        max={230}
        suggestedValue={175}
        suffix="cm"
        label="Height"
      />,
    );

    const range = screen.getByRole('slider', { name: 'Height' });
    fireEvent.pointerDown(range);
    expect(onValue).toHaveBeenCalledWith(175);

    fireEvent.click(screen.getByRole('button', { name: 'Increase Height' }));
    expect(onValue).toHaveBeenLastCalledWith(176);
  });
});
