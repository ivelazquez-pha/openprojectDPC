# frozen_string_literal: true

#-- copyright
# OpenProject is an open source project management software.
# Copyright (C) the OpenProject GmbH
#
# This program is free software; you can redistribute it and/or
# modify it under the terms of the GNU General Public License version 3.
#
# OpenProject is a fork of ChiliProject, which is a fork of Redmine. The copyright follows:
# Copyright (C) 2006-2013 Jean-Philippe Lang
# Copyright (C) 2010-2013 the ChiliProject Team
#
# This program is free software; you can redistribute it and/or
# modify it under the terms of the GNU General Public License
# as published by the Free Software Foundation; either version 2
# of the License, or (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
#
# See COPYRIGHT and LICENSE files for more details.
#++

##
# Kanban board card configuration for a single Type.
#
# Stores an ordered list of work package attribute identifiers to render as
# extra `label: value` rows on Kanban board cards for work packages of this
# type. This is a global, admin-only setting (no per-board or per-user
# override).
#
# Normalization: an attribute identifier that was configured in the past but
# is no longer a valid work package attribute for this type (e.g. a deleted
# custom field, or a constraint added by a plugin) is silently dropped from
# +field_ids+ so that stale configuration can never cause a rendering
# failure. The stored raw value is left untouched until the admin saves the
# form again (at which point the contract only accepts currently-valid
# identifiers).
class Type::BoardCardConfiguration
  # `"date"` is a genuine work package API attribute, but only ever rendered
  # for Milestone-type work packages (see
  # `lib/api/v3/work_packages/work_package_representer.rb`'s `date_property
  # :date`). Board card configuration is not milestone-aware, so `"date"` is
  # never treated as available here; `start_date`/`due_date` (offered via
  # `merge_date: false`) already cover the general case.
  MILESTONE_ONLY_DATE_ATTRIBUTE = "date"

  def initialize(type)
    @type = type
  end

  ##
  # The effective, ordered list of field identifiers to render on board
  # cards for this type, with any no-longer-available identifiers removed.
  #
  # `Array#&` preserves the order of the receiver and removes duplicates,
  # which is exactly the semantics we want here: the admin-configured order
  # is preserved, and anything not currently available is dropped.
  def field_ids
    configured & available_field_ids
  end

  ##
  # The identifiers of every work package attribute currently selectable as a
  # board card field for this type, in the API v3 camelCase format (e.g.
  # `startDate`, `customField1`) that both the admin picker
  # (`BoardCardConfigurationComponent#sorted_available_attributes`) and the
  # `UpdateBoardCardConfigurationContract` validation rely on, so that the
  # same set of identifiers is offered, validated, and stored everywhere.
  #
  # Uses `merge_date: false` so the real `start_date`/`due_date` attributes
  # are available individually, instead of the merged pseudo `"date"` entry
  # that only exists for the Type's form-layout-configuration screen.
  #
  # `"date"` itself is excluded: it is a genuine work package API attribute,
  # but only ever rendered for Milestone-type work packages (see
  # `lib/api/v3/work_packages/work_package_representer.rb`'s `date_property
  # :date`). Board card configuration is not milestone-aware, so offering it
  # here could crash/fail to resolve for non-milestone work packages of the
  # same type; `start_date`/`due_date` already cover the general case.
  def available_field_ids
    @type
      .work_package_attributes(merge_date: false)
      .keys
      .reject { |key| key == MILESTONE_ONLY_DATE_ATTRIBUTE }
      .map { |key| API::Utilities::PropertyNameConverter.from_ar_name(key) }
  end

  private

  def configured
    Array(@type.board_card_field_ids)
  end
end
