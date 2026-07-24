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

import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ApiV3Service } from 'core-app/core/apiv3/api-v3.service';
import { QuerySortByResource } from 'core-app/features/hal/resources/query-sort-by-resource';
import { BoardOrderDirection } from 'core-app/core/apiv3/endpoints/grids/apiv3-grid-board-order';
import {
  BoardSortField,
  unionSortableFields,
  toQueryFieldName,
} from 'core-app/features/boards/board/board-sort/board-sort-field';

/**
 * Thin coordinator around the bounded board "Sort by..." command
 * (`POST /api/v3/grids/:id/board_order`, see Unit 1's
 * `Boards::BoardOrderService`).
 *
 * This service never infers sort eligibility or the 500-card limit from
 * loaded/paginated card counts - it only picks field + direction and calls
 * the endpoint. The backend is the sole source of truth for the limit and
 * does the real counting server-side (design r8).
 */
@Injectable({ providedIn: 'root' })
export class BoardSortService {
  private readonly apiV3Service = inject(ApiV3Service);

  public unionFields(perColumnAvailable:QuerySortByResource[][]):BoardSortField[] {
    return unionSortableFields(perColumnAvailable);
  }

  /**
   * Applies the sort and, ONLY once the write has actually committed (the
   * HTTP call resolved successfully), invokes `refresh`. `refresh` MUST NOT
   * run optimistically before the server confirms the write, and MUST NOT
   * run at all if the request fails (e.g. the 500-card limit was exceeded,
   * or the direction/field was rejected) - see design "D13" and the bounded
   * sort data flow's zero-writes-on-failure guarantee.
   */
  public applyAndRefresh(
    gridId:string|number,
    fieldId:string,
    direction:BoardOrderDirection,
    refresh:() => void,
  ):Observable<void> {
    return this
      .apiV3Service
      .grids
      .id(gridId)
      .boardOrder
      .create(toQueryFieldName(fieldId), direction)
      .pipe(
        tap(() => refresh()),
      );
  }
}
