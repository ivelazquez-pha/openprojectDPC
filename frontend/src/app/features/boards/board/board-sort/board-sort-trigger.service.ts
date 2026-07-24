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

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface BoardSortTriggerState {
  /** Whether the board-wide "Sort by..." trigger should currently render. */
  canSort:boolean;
  /** Opens the real sort modal, resolving the current board internally. */
  openModal:() => void;
}

const HIDDEN_STATE:BoardSortTriggerState = {
  canSort: false,
  openModal: () => undefined,
};

/**
 * Shared coordination point between `BoardListContainerComponent` (the sole
 * owner of the real per-column state, via `@ViewChildren(BoardListComponent)
 * lists`) and the toolbar-level `BoardSortTriggerComponent` (registered in
 * `BoardPartitionedPageComponent.toolbarButtonComponents`, next to the board
 * filter button).
 *
 * The toolbar button is NOT a descendant of `BoardListContainerComponent` -
 * it is instantiated via `<ndc-dynamic>` using `BoardPartitionedPageComponent`
 * own `Injector`, while `BoardListContainerComponent` lives further down the
 * SAME page's `<ng-content>` projection. Neither `inject()` nor
 * `@ViewChildren` can reach across that branch, so this service - provided
 * once per board page in `BoardPartitionedPageComponent.providers`, exactly
 * like the existing `BoardFiltersService` - acts as the shared ancestor
 * bridge instead.
 *
 * State is pushed explicitly via `publish()`, mirroring the `sortabilityChange`
 * `@Output()` fix from the previous bug fix batch: both the container and the
 * toolbar button are `OnPush`, so a plain synchronous getter read from the
 * toolbar button would never re-check itself once the container's state
 * changes asynchronously. Consumers MUST read `state$` reactively (e.g. via
 * the `async` pipe), never via a synchronous snapshot getter.
 */
@Injectable()
export class BoardSortTriggerService {
  private readonly state = new BehaviorSubject<BoardSortTriggerState>(HIDDEN_STATE);

  public readonly state$:Observable<BoardSortTriggerState> = this.state.asObservable();

  public publish(state:BoardSortTriggerState):void {
    this.state.next(state);
  }

  public clear():void {
    this.state.next(HIDDEN_STATE);
  }
}
