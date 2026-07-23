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

import { Injector } from '@angular/core';
import { InjectField } from 'core-app/shared/helpers/angular/inject-field.decorator';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { SimpleResource } from 'core-app/core/apiv3/paths/path-resources';

export type BoardOrderDirection = 'asc'|'desc';

/**
 * `POST /api/v3/grids/:id/board_order` - the bounded, synchronous "Sort
 * by..." command implemented by `Boards::BoardOrderService` (see Unit 1).
 *
 * Responds 204 with no body on success. Errors (404 unauthorized/missing,
 * 422 invalid field or 500-card limit exceeded, 409 retry exhausted) are
 * left to propagate as a raw `HttpErrorResponse` so callers can hand them to
 * `HalResourceNotificationService`, exactly like other plain HttpClient
 * commands in this codebase (see `ApiV3QueryOrder`).
 */
export class ApiV3GridBoardOrder extends SimpleResource {
  @InjectField() http:HttpClient;

  constructor(readonly injector:Injector,
    readonly basePath:string,
    readonly id:string|number) {
    super(basePath, id);
  }

  public create(field:string, direction:BoardOrderDirection):Observable<void> {
    return this.http.post<void>(
      this.path,
      { field, direction },
      { withCredentials: true },
    );
  }
}
