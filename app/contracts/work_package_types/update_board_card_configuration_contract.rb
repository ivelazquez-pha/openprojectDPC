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

module WorkPackageTypes
  class UpdateBoardCardConfigurationContract < BaseContract
    # `board_card_field_ids` is a `store_attribute`-backed virtual accessor on
    # the `board_card_configuration` jsonb column (see `Type`). Using the
    # dedicated `stored_attribute` DSL (rather than plain `attribute`) is
    # required here: store_attribute dirties BOTH the virtual accessor and
    # the underlying jsonb column, and `ModelContract`'s readonly-attribute
    # check would otherwise reject the (correctly authorized) write to the
    # underlying `board_card_configuration` column with `error_readonly`.
    stored_attribute :board_card_field_ids, store: :board_card_configuration

    validate :validate_field_ids

    private

    def validate_field_ids
      ids = model.board_card_field_ids

      return if ids.blank?

      unless ids.is_a?(Array) && ids.all? { |id| id.is_a?(String) }
        errors.add(:board_card_field_ids, :invalid)
        return
      end

      unknown_ids = ids - model.board_card_fields.available_field_ids
      errors.add(:board_card_field_ids, :invalid) if unknown_ids.any?
    end
  end
end
