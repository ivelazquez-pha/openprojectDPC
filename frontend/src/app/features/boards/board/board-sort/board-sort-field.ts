//-- copyright
// OpenProject is an open source project management software.
// Copyright (C) the OpenProject GmbH
//
// This program is free software; you can redistribute it and/or
// modify it under the terms of the GNU General Public License version 3.
//
// OpenProject is a fork of ChiliProject, which is a fork of Redmine. The copyright follows:
// Copyright (C) 2006-2013 Jean-Philippe Lang
// Copyright (C) 2010-2013 the ChiliProject Team
//
// This program is free software; you can redistribute it and/or
// modify it under the terms of the GNU General Public License
// as published by the Free Software Foundation; either version 2
// of the License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program; if not, write to the Free Software
// Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
//
// See COPYRIGHT and LICENSE files for more details.
//++

import { QuerySortByResource } from 'core-app/features/hal/resources/query-sort-by-resource';

export interface BoardSortField {
  id:string;
  name:string;
}

/**
 * Attribute API identifiers (camelCase, as exposed on `QueryColumn#id`) that
 * are backed by a `belongs_to`/`has_many` association rather than a plain
 * WorkPackage-table column. Unit 1's `Boards::BoardOrderService` deliberately
 * only supports plain, non-association sortable columns for this bounded
 * command (see apply-progress "Known scope limitation"), so the picker MUST
 * exclude these even though the query schema may report them as generally
 * sortable (they are sortable for the *table*, but not for the bounded board
 * sort command).
 *
 * This list is a curated, documented subset - not derived from Rails
 * metadata - because there is no API-exposed signal distinguishing
 * association-backed columns from plain ones. Keep it in sync with
 * `Boards::BoardOrderService#plain_sortable_column` if that changes.
 */
const ASSOCIATION_BACKED_FIELD_IDS = new Set<string>([
  'status',
  'type',
  'priority',
  'assignee',
  'responsible',
  'author',
  'version',
  'category',
  'project',
  'parent',
  'budget',
]);

/**
 * Special-case API (camelCase) -> query/AR (snake_case) attribute name
 * conversions, mirroring `Constants::ARToAPIConversions` on the backend.
 * Everything not listed here is converted via the generic camelCase ->
 * snake_case rule, which is safe for the remaining plain sortable columns
 * (e.g. `subject`, `dueDate` -> `due_date`, `startDate` -> `start_date`).
 */
const API_TO_QUERY_FIELD_NAME:Record<string, string> = {
  assignee: 'assigned_to',
  percentageDone: 'done_ratio',
  derivedPercentageDone: 'derived_done_ratio',
  estimatedTime: 'estimated_hours',
  remainingTime: 'remaining_hours',
  spentTime: 'spent_hours',
  subprojectId: 'subproject',
  email: 'mail',
  firstName: 'firstname',
  lastName: 'lastname',
};

/**
 * Matches a custom field API identifier (e.g. `customField1`), as produced
 * by `CustomField#attribute_name(:camel_case)` on the backend.
 */
const CUSTOM_FIELD_ID_PATTERN = /^customField(\d+)$/;

/**
 * Converts a `QueryColumn#id` (camelCase API attribute identifier) to the
 * snake_case field name `Boards::BoardOrderService` expects in its `field`
 * parameter.
 *
 * Post-deploy bug fix: custom fields need their OWN conversion rule, not the
 * generic camelCase -> snake_case one. The backend's short column name for a
 * custom field is `cf_<id>` (`CustomField#column_name`), NOT
 * `custom_field_<id>` or `custom_field<id>` - see
 * `API::Utilities::PropertyNameConverter#collapse_custom_field_name` and
 * `app/services/api/v3/parse_query_params_service.rb`'s own documented
 * example ("customField1 => cf_1"). Running `customField1` through the
 * generic regex instead produces `custom_field1`, which never matches any
 * column's `sortable_columns` entry - `Boards::BoardOrderService` then
 * rejects the request as `:invalid_field` (422) for every custom field, on
 * every board, unconditionally.
 */
export function toQueryFieldName(apiFieldId:string):string {
  const specialCase = API_TO_QUERY_FIELD_NAME[apiFieldId];
  if (specialCase) {
    return specialCase;
  }

  const customFieldMatch = apiFieldId.match(CUSTOM_FIELD_ID_PATTERN);
  if (customFieldMatch) {
    return `cf_${customFieldMatch[1]}`;
  }

  return apiFieldId.replace(/([A-Z])/g, (_match, letter:string) => `_${letter.toLowerCase()}`);
}

export function isAssociationBackedField(apiFieldId:string):boolean {
  return ASSOCIATION_BACKED_FIELD_IDS.has(apiFieldId);
}

/**
 * Unions the sortable fields available across all board columns, excluding
 * manual sorting, the hierarchy `/parent` pseudo-column, and known
 * association-backed columns (see `ASSOCIATION_BACKED_FIELD_IDS`).
 *
 * A field is offered as soon as it is sortable in AT LEAST ONE column - it
 * does NOT need to be sortable in every column. This is deliberate: on a
 * board whose columns span multiple Types or projects (e.g. a status board,
 * or any board where a custom field is only assigned to one Type/project),
 * requiring universal availability across every column would frequently
 * leave zero candidate fields, even though the user may specifically want
 * to sort by a field that only applies to some columns. Columns where the
 * chosen field does not apply simply sort last (see
 * `Boards::BoardOrderService`, which resolves the field from any
 * participating column and treats the rest as NULL-for-that-field rather
 * than rejecting the whole request).
 *
 * Each element of `perColumnAvailable` is one column's own
 * `WorkPackageViewSortByService#available` list (already scoped to that
 * column's isolated query space) - this function never infers eligibility
 * from card counts, only from what each column's own schema reports as
 * sortable.
 *
 * ROOT CAUSE this function must keep working around: the real
 * `POST /api/v3/queries/:id/form` response only ever exposes each sort
 * option's `column` as a bare `_links.column` reference (`{ href, title }`),
 * never as an `_embedded` resource carrying its own `id`. When the frontend
 * hydrates that link into a `HalResource`
 * (`HalResourceService.createLinkedResource`), the resulting resource's
 * `$source` has no `id` field at all, so `HalResource#id` falls back to
 * parsing the href - but that generic fallback (`hal-resource.ts`) only
 * accepts PURELY NUMERIC trailing href segments (e.g. `/statuses/5` -> `5`);
 * query column identifiers are alphanumeric (`startDate`, `customField1`,
 * ...), so `sort.column.id` is unconditionally `null` for every real sort
 * option, in every column, on every board. Reading `sort.column.id` here -
 * as this function used to - therefore excluded 100% of fields, not just
 * association-backed ones, regardless of the schema's actual content. The
 * fix mirrors `QuerySortByDirection#id` and derives the identifier directly
 * from the (already href-validated) `href` instead of trusting `.id`.
 */
export function unionSortableFields(perColumnAvailable:QuerySortByResource[][]):BoardSortField[] {
  const union = new Map<string, string>();

  perColumnAvailable.forEach((available) => {
    available.forEach((sort) => {
      const href = sort.column.href;
      if (!href || href.endsWith('/manualSorting') || href.endsWith('/parent')) {
        return;
      }

      const id = href.split('/').pop();
      if (!id || isAssociationBackedField(id)) {
        return;
      }

      union.set(id, sort.column.name);
    });
  });

  return Array.from(union, ([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Whether the board sort action should be offered at all: requires at least
 * one column, and every column's query must authorize
 * `reorder_work_packages` (surfaced on the frontend as the
 * `updateOrderedWorkPackages` HAL link, the same signal drag & drop already
 * uses - see `BoardListComponent#canDragOutOf`).
 */
export function canSortBoard(queryHasReorderPermission:boolean[]):boolean {
  return queryHasReorderPermission.length > 0 && queryHasReorderPermission.every(Boolean);
}
