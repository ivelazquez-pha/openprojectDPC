import { WorkPackageResource } from 'core-app/features/hal/resources/work-package-resource';
import { CardFieldConfig } from 'core-app/features/hal/resources/type-resource';

/**
 * Map from a work package Type's id (as a string) to its ordered list of
 * configured Kanban board card field rows (per Type::BoardCardConfiguration
 * on the backend, exposed read-only via the Type resource's `boardCardFields`).
 */
export type TypeCardFieldsByTypeId = Record<string, CardFieldConfig[]>;

/**
 * Resolve which extra field configs should render as additional rows on a
 * single Kanban board card, given the work package's OWN type and a
 * pre-built map of every type's configured board card fields.
 *
 * This is a pure function so that the mixed-Types-on-the-same-board and
 * unconfigured/missing-type-entry cases can be unit tested without any
 * Angular test bed or schema loading involved.
 */
export function resolveTypeCardFields(
  workPackage:WorkPackageResource,
  typeCardFieldsByTypeId:TypeCardFieldsByTypeId,
):CardFieldConfig[] {
  const typeId = workPackage?.type?.id as string|undefined;
  if (!typeId) {
    return [];
  }

  return typeCardFieldsByTypeId[typeId] || [];
}
