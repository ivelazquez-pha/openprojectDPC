import { WorkPackageResource } from 'core-app/features/hal/resources/work-package-resource';

/**
 * Resolve the label to show on a work package's full/detail view "combined
 * date" trigger -- the compact summary (e.g. "Fecha: sin fecha de inicio -
 * 27/08/2026") that opens the scheduling modal.
 *
 * Defaults to the given standard translation. Can be overridden per
 * work-package Type via `Type#due_date_label` -- the SAME setting already
 * used for the `dueDate` schema field's name
 * (`WorkPackageSchemaRepresenter`'s `schema :due_date` `name_source:`).
 * Exposed read-only on the Type v3 resource as `dueDateLabel`.
 *
 * This ONLY affects the outer trigger caption. It intentionally does NOT
 * touch the date-picker modal's internal "Start date"/"Finish date" field
 * captions, which are sourced independently and must remain unchanged.
 *
 * Pure function so the override/fallback/blank/missing-type cases can be
 * unit tested without any Angular test bed or schema loading involved.
 */
export function dateFieldLabel(workPackage:WorkPackageResource, standardLabel:string):string {
  const override = workPackage?.type?.dueDateLabel;
  return override && override.length > 0 ? override : standardLabel;
}
