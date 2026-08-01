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

import { HalResource } from 'core-app/features/hal/resources/hal-resource';
import { InputState } from '@openproject/reactivestates';

export class TypeResource extends HalResource {
  public color:string;

  /**
   * Ordered list of extra work package attribute identifiers configured to
   * render on Kanban board cards for work packages of this type. Board-only;
   * has no effect outside of board card rendering. Read-only.
   */
  public boardCardFieldIds:string[]|undefined;

  /**
   * Optional override for the label shown on a work package's full/detail
   * view "combined date" trigger (e.g. instead of the standard "Date"
   * label). Undefined/blank means the standard translated label is used.
   * Does not affect the date-picker modal's internal "Start date"/"Finish
   * date" captions. Read-only.
   */
  public dueDateLabel:string|undefined;

  public get state():InputState<this> {
    return this.states.types.get(this.href!) as any;
  }
}
