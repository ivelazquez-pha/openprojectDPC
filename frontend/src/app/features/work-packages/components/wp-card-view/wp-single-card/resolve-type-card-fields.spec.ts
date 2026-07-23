import { resolveTypeCardFields } from 'core-app/features/work-packages/components/wp-card-view/wp-single-card/resolve-type-card-fields';
import { WorkPackageResource } from 'core-app/features/hal/resources/work-package-resource';

function wpWithType(typeId:string|undefined):WorkPackageResource {
  return {
    type: typeId ? { id: typeId } : undefined,
  } as unknown as WorkPackageResource;
}

describe('resolveTypeCardFields', () => {
  it('returns the configured fields for the work package\'s own type', () => {
    const map = {
      '1': ['priority', 'assignee'],
      '2': ['dueDate'],
    };

    expect(resolveTypeCardFields(wpWithType('1'), map)).toEqual(['priority', 'assignee']);
    expect(resolveTypeCardFields(wpWithType('2'), map)).toEqual(['dueDate']);
  });

  it('renders each card according to its OWN type when Types are mixed on the same board', () => {
    const map = {
      bug: ['priority'],
      task: ['assignee', 'dueDate'],
    };

    expect(resolveTypeCardFields(wpWithType('bug'), map)).toEqual(['priority']);
    expect(resolveTypeCardFields(wpWithType('task'), map)).toEqual(['assignee', 'dueDate']);
  });

  it('returns an empty array when the type has no entry in the map', () => {
    expect(resolveTypeCardFields(wpWithType('unknown-type'), {})).toEqual([]);
  });

  it('returns an empty array when the work package has no type', () => {
    expect(resolveTypeCardFields(wpWithType(undefined), { '1': ['priority'] })).toEqual([]);
  });
});
