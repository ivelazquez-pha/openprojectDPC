import { dateFieldLabel } from 'core-app/features/work-packages/components/wp-single-view/date-field-label';

describe('dateFieldLabel', () => {
  const standardLabel = 'Fecha';

  it('uses the Type override when configured', () => {
    expect(dateFieldLabel('Fecha de licitación', standardLabel)).toBe('Fecha de licitación');
  });

  it('falls back to the standard label when no override is given', () => {
    expect(dateFieldLabel(undefined, standardLabel)).toBe(standardLabel);
  });

  it('falls back to the standard label when the override is blank', () => {
    expect(dateFieldLabel('', standardLabel)).toBe(standardLabel);
  });
});
