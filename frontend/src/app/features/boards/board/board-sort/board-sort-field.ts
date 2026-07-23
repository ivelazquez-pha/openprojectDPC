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
 * `Boards::BoardOrderService#plain_sortable_expression` if that changes.
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
 * Converts a `QueryColumn#id` (camelCase API attribute identifier) to the
 * snake_case field name `Boards::BoardOrderService` expects in its `field`
 * parameter.
 */
export function toQueryFieldName(apiFieldId:string):string {
  const specialCase = API_TO_QUERY_FIELD_NAME[apiFieldId];
  if (specialCase) {
    return specialCase;
  }

  return apiFieldId.replace(/([A-Z])/g, (_match, letter:string) => `_${letter.toLowerCase()}`);
}

export function isAssociationBackedField(apiFieldId:string):boolean {
  return ASSOCIATION_BACKED_FIELD_IDS.has(apiFieldId);
}

/**
 * Intersects the sortable fields available on every board column, excluding
 * manual sorting, the hierarchy `/parent` pseudo-column, and known
 * association-backed columns (see `ASSOCIATION_BACKED_FIELD_IDS`).
 *
 * Each element of `perColumnAvailable` is one column's own
 * `WorkPackageViewSortByService#available` list (already scoped to that
 * column's isolated query space) - this function never infers eligibility
 * from card counts, only from what each column's own schema reports as
 * sortable.
 */
export function intersectSortableFields(perColumnAvailable:QuerySortByResource[][]):BoardSortField[] {
  if (perColumnAvailable.length === 0) {
    return [];
  }

  const columnFieldMaps = perColumnAvailable.map((available) => {
    const map = new Map<string, string>();

    available.forEach((sort) => {
      const href = sort.column.href;
      if (!href || href.endsWith('/manualSorting') || href.endsWith('/parent')) {
        return;
      }

      const id = sort.column.id;
      if (!id || isAssociationBackedField(id)) {
        return;
      }

      map.set(id, sort.column.name);
    });

    return map;
  });

  const [first, ...rest] = columnFieldMaps;
  const intersected:BoardSortField[] = [];

  first.forEach((name, id) => {
    if (rest.every((columnMap) => columnMap.has(id))) {
      intersected.push({ id, name });
    }
  });

  return intersected.sort((a, b) => a.name.localeCompare(b.name));
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
