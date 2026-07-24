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

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { I18nService } from 'core-app/core/i18n/i18n.service';
import { BoardSortTriggerService } from 'core-app/features/boards/board/board-sort/board-sort-trigger.service';

/**
 * Board-wide "Sort by..." toolbar trigger. Registered in
 * `BoardPartitionedPageComponent.toolbarButtonComponents`, next to the board
 * filter button (`WorkPackageFilterButtonComponent`), instead of living
 * inside `board-list-container.component.html` next to "Add list".
 *
 * Deliberately reads its `canSort`/`openModal` state ONLY through
 * `BoardSortTriggerService#state$` via the `async` pipe - never through a
 * synchronous getter - because this component is `OnPush` and lives in a
 * different branch of the component tree than `BoardListContainerComponent`
 * (see `BoardSortTriggerService` for why). A synchronous read would
 * reintroduce the exact "button never appears until an unrelated change
 * detection sweep" bug already fixed for the old trigger location.
 */
@Component({
  template: `
    @if (state$ | async; as state) {
      @if (state.canSort) {
        <div
          class="board--sort-toolbar-button"
          role="button"
          tabindex="0"
          [title]="text.sortBy"
          data-test-selector="board-sort--trigger"
          (click)="state.openModal()"
          (keydown.enter)="state.openModal()"
          (keydown.space)="state.openModal()">
          <op-icon icon-classes="icon-sort icon-context" />
        </div>
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class BoardSortTriggerComponent {
  private readonly boardSortTrigger = inject(BoardSortTriggerService);
  private readonly I18n = inject(I18nService);

  public readonly state$ = this.boardSortTrigger.state$;

  text = {
    sortBy: this.I18n.t('js.boards.sort_by.action'),
  };
}
