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
 * IMPORTANT: `dueDateLabelOverride` MUST be resolved from a guaranteed-fresh,
 * fully-rendered Type resource -- e.g. the dedicated `apiV3Service.types`
 * per-Type cache -- and NOT read directly off `workPackage.type`. The work
 * package's own embedded `type` is only fully rendered (with `dueDateLabel`
 * present) when the work package itself was fetched with `embed_links: true`
 * (the single-WP GET). Work packages fetched or cached as part of a
 * collection/board query (`embed_links: false`, e.g. the Kanban board's own
 * query) only carry a link-only `type`, without `dueDateLabel`. Since the
 * frontend's per-work-package entity cache (`StateCacheService`) treats ANY
 * cached value as fresh for up to an hour regardless of how complete it is,
 * a work package opened from the board -- or reloaded while the board is
 * also refetching -- can silently end up with this incomplete `type`,
 * permanently reverting the trigger to the standard label until the
 * work package's own cache entry happens to expire. See
 * wp-single-view.component.ts for how the override is resolved from the
 * dedicated, board-query-immune Types cache instead.
 *
 * Pure function so the override/fallback/blank cases can be unit tested
 * without any Angular test bed or schema loading involved.
 */
export function dateFieldLabel(dueDateLabelOverride:string|undefined, standardLabel:string):string {
  return dueDateLabelOverride && dueDateLabelOverride.length > 0 ? dueDateLabelOverride : standardLabel;
}
