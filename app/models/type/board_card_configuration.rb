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

  private

  def configured
    Array(@type.board_card_field_ids)
  end

  def available_field_ids
    @type.work_package_attributes.keys
  end
end
