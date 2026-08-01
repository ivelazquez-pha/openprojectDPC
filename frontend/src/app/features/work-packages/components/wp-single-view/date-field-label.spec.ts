import { dateFieldLabel } from 'core-app/features/work-packages/components/wp-single-view/date-field-label';
import { WorkPackageResource } from 'core-app/features/hal/resources/work-package-resource';

function wpWithDueDateLabel(dueDateLabel:string|undefined):WorkPackageResource {
  return {
    type: { dueDateLabel },
  } as unknown as WorkPackageResource;
}

describe('dateFieldLabel', () => {
  const standardLabel = 'Fecha';

  it('uses the Type override when configured', () => {
    expect(dateFieldLabel(wpWithDueDateLabel('Fecha de licitación'), standardLabel)).toBe('Fecha de licitación');
  });

  it('falls back to the standard label when the Type has no override', () => {
    expect(dateFieldLabel(wpWithDueDateLabel(undefined), standardLabel)).toBe(standardLabel);
  });

  it('falls back to the standard label when the override is blank', () => {
    expect(dateFieldLabel(wpWithDueDateLabel(''), standardLabel)).toBe(standardLabel);
  });

  it('falls back to the standard label when the work package has no type at all', () => {
    const wp = {} as unknown as WorkPackageResource;
    expect(dateFieldLabel(wp, standardLabel)).toBe(standardLabel);
  });
});
