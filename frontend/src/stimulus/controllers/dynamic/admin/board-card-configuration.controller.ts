/*
 * -- copyright
 * OpenProject is an open source project management software.
 * Copyright (C) the OpenProject GmbH
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License version 3.
 *
 * OpenProject is a fork of ChiliProject, which is a fork of Redmine. The copyright follows:
 * Copyright (C) 2006-2013 Jean-Philippe Lang
 * Copyright (C) 2010-2013 the ChiliProject Team
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 *
 * See COPYRIGHT and LICENSE files for more details.
 * ++
 */

import { Controller } from '@hotwired/stimulus';

/**
 * Add/remove rows in the Kanban board card fields admin form (Type ->
 * "Board card fields" tab). Each row's inputs are named
 * `...[board_card_field_ids][INDEX][field_id|zone|color_id|background_color_id|show_label|bold]`
 * -- `addRow` clones the last row and rewrites `INDEX` to the next integer,
 * mirroring `admin--custom-fields`' `addOption` (see
 * `custom-fields.controller.ts`), which uses the same
 * clone-and-reindex-by-string-replacement approach for a comparable
 * dynamic-row admin form.
 */
export default class BoardCardConfigurationController extends Controller {
  static targets = ['row'];

  declare readonly rowTargets:HTMLTableRowElement[];

  // Default `checked` state for a fresh row's checkboxes, keyed by the
  // field name they end in -- NOT uniformly `true`: `show_label` defaults
  // to shown, but `bold` defaults to off (see `Type::BoardCardConfiguration
  // ::FieldConfig`'s own `show_label`/`bold` defaults on the backend).
  private static readonly CHECKBOX_DEFAULTS:Record<string, boolean> = {
    show_label: true,
    bold: false,
  };

  addRow() {
    const count = this.rowTargets.length;
    const last = this.rowTargets[count - 1];
    const clone = last.cloneNode(true) as HTMLTableRowElement;

    clone.querySelectorAll('select').forEach((select) => {
      const el = select as HTMLSelectElement;
      el.name = el.name.replace(/\[\d+\]/, `[${count}]`);
      el.removeAttribute('id');
      el.selectedIndex = 0;
    });

    clone.querySelectorAll('input').forEach((input) => {
      const el = input as HTMLInputElement;
      el.name = el.name.replace(/\[\d+\]/, `[${count}]`);
      el.removeAttribute('id');
      if (el.type === 'checkbox') {
        const match = /\[(\w+)\]$/.exec(el.name);
        const fieldName = match ? match[1] : '';
        el.checked = BoardCardConfigurationController.CHECKBOX_DEFAULTS[fieldName] ?? false;
      }
    });

    last.insertAdjacentElement('afterend', clone);
  }

  removeRow(event:{ target:HTMLElement, preventDefault: () => void }) {
    event.preventDefault();
    const row = event.target.closest('tr');

    if (row && this.rowTargets.length > 1) {
      row.remove();
    }
  }
}
