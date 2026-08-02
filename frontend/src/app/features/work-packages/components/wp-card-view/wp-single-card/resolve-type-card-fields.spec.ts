import { resolveTypeCardFields } from 'core-app/features/work-packages/components/wp-card-view/wp-single-card/resolve-type-card-fields';
import { WorkPackageResource } from 'core-app/features/hal/resources/work-package-resource';
import { CardFieldConfig } from 'core-app/features/hal/resources/type-resource';

function wpWithType(typeId:string|undefined):WorkPackageResource {
  return {
    type: typeId ? { id: typeId } : undefined,
  } as unknown as WorkPackageResource;
}

function fieldConfig(fieldId:string, overrides:Partial<CardFieldConfig> = {}):CardFieldConfig {
  return {
    fieldId,
    zone: 'middle',
    color: null,
    backgroundColor: null,
    showLabel: true,
    ...overrides,
  };
}

describe('resolveTypeCardFields', () => {
  it('returns the configured fields for the work package\'s own type', () => {
    const map = {
      '1': [fieldConfig('priority'), fieldConfig('assignee')],
      '2': [fieldConfig('dueDate')],
    };

    expect(resolveTypeCardFields(wpWithType('1'), map)).toEqual(map['1']);
    expect(resolveTypeCardFields(wpWithType('2'), map)).toEqual(map['2']);
  });

  it('renders each card according to its OWN type when Types are mixed on the same board', () => {
    const map = {
      bug: [fieldConfig('priority')],
      task: [fieldConfig('assignee'), fieldConfig('dueDate')],
    };

    expect(resolveTypeCardFields(wpWithType('bug'), map)).toEqual(map.bug);
    expect(resolveTypeCardFields(wpWithType('task'), map)).toEqual(map.task);
  });

  it('returns an empty array when the type has no entry in the map', () => {
    expect(resolveTypeCardFields(wpWithType('unknown-type'), {})).toEqual([]);
  });

  it('returns an empty array when the work package has no type', () => {
    expect(resolveTypeCardFields(wpWithType(undefined), { '1': [fieldConfig('priority')] })).toEqual([]);
  });
});
