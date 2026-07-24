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

import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { OpModalComponent } from 'core-app/shared/components/modal/modal.component';
import { I18nService } from 'core-app/core/i18n/i18n.service';
import { HalResourceNotificationService } from 'core-app/features/hal/services/hal-resource-notification.service';
import { ToastService } from 'core-app/shared/components/toaster/toast.service';
import { BoardSortService } from 'core-app/features/boards/board/board-sort/board-sort.service';
import { BoardOrderDirection } from 'core-app/core/apiv3/endpoints/grids/apiv3-grid-board-order';
import { BoardSortField } from 'core-app/features/boards/board/board-sort/board-sort-field';

export interface BoardSortModalLocals {
  gridId:string|number;
  availableFields:BoardSortField[];
  refresh:() => void;
}

/**
 * The "Sort by..." modal for a Kanban board. Offers the union of fields
 * sortable in at least one column (computed and passed in via locals by the
 * caller), and calls the bounded board sort command exactly once per
 * confirm - never inferring eligibility or the 500-card limit itself.
 */
@Component({
  templateUrl: './board-sort.modal.html',
  standalone: false,
  // TODO: This component has been partially migrated to be zoneless-compatible.
  // After testing, this should be updated to ChangeDetectionStrategy.OnPush.
  // eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
  changeDetection: ChangeDetectionStrategy.Default,
})
export class BoardSortModalComponent extends OpModalComponent implements OnInit {
  readonly I18n = inject(I18nService);
  readonly halNotification = inject(HalResourceNotificationService);
  readonly boardSortService = inject(BoardSortService);
  readonly toastService = inject(ToastService);

  public availableFields:BoardSortField[] = [];

  public selectedFieldId:string|null = null;

  public direction:BoardOrderDirection = 'asc';

  public inFlight = false;

  public text = {
    title: this.I18n.t('js.boards.sort_by.title'),
    fieldLabel: this.I18n.t('js.boards.sort_by.field_label'),
    ascending: this.I18n.t('js.label_ascending'),
    descending: this.I18n.t('js.label_descending'),
    apply: this.I18n.t('js.boards.sort_by.apply'),
    cancel: this.I18n.t('js.button_cancel'),
    noFields: this.I18n.t('js.boards.sort_by.no_fields'),
    updateSuccessful: this.I18n.t('js.notice_successful_update'),
  };

  ngOnInit() {
    super.ngOnInit();

    this.availableFields = this.modalLocals.availableFields;
    this.selectedFieldId = this.modalLocals.availableFields[0]?.id ?? null;
  }

  private get modalLocals():BoardSortModalLocals {
    return this.locals as unknown as BoardSortModalLocals;
  }

  public selectField(fieldId:string):void {
    this.selectedFieldId = fieldId;
  }

  public selectDirection(direction:BoardOrderDirection):void {
    this.direction = direction;
  }

  public apply():void {
    if (!this.selectedFieldId || this.inFlight) {
      return;
    }

    this.inFlight = true;
    const { gridId, refresh } = this.modalLocals;

    this
      .boardSortService
      .applyAndRefresh(gridId, this.selectedFieldId, this.direction, refresh)
      .subscribe({
        next: () => {
          this.inFlight = false;
          this.toastService.addSuccess(this.text.updateSuccessful);
          this.closeMe();
        },
        error: (error:unknown) => {
          this.inFlight = false;
          this.halNotification.handleRawError(error);
          this.cdRef.detectChanges();
        },
      });
  }
}
