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

    ZONES = Type::BoardCardConfiguration::ZONES

    def validate_field_ids
      entries = model.board_card_field_ids

      return if entries.blank?

      unless entries.is_a?(Array) && entries.all? { |entry| valid_entry_shape?(entry) }
        errors.add(:board_card_field_ids, :invalid)
        return
      end

      ids = entries.map { |entry| entry.is_a?(Hash) ? entry["field_id"] || entry[:field_id] : entry }
      unknown_ids = ids - model.board_card_fields.available_field_ids
      errors.add(:board_card_field_ids, :invalid) if unknown_ids.any?

      duplicate_ids = ids.tally.select { |_, count| count > 1 }.keys
      errors.add(:board_card_field_ids, :invalid) if duplicate_ids.any?
    end

    def valid_entry_shape?(entry)
      case entry
      when String
        true
      when Hash
        valid_hash_entry?(entry.stringify_keys)
      else
        false
      end
    end

    def valid_hash_entry?(entry)
      # `color_id`/`background_color_id` arrive as `""` (not absent/nil) when
      # the admin form's "none" option is selected -- `select_tag`'s blank
      # option still submits an empty string. `show_label` always casts
      # cleanly via `ActiveModel::Type::Boolean` (see
      # `Type::BoardCardConfiguration#normalize_hash`), so any value for it
      # is acceptable here.
      entry["field_id"].is_a?(String) &&
        (entry["zone"].blank? || ZONES.include?(entry["zone"])) &&
        (entry["color_id"].blank? || existing_color_id?(entry["color_id"])) &&
        (entry["background_color_id"].blank? || existing_color_id?(entry["background_color_id"]))
    end

    def existing_color_id?(color_id)
      existing_color_ids.include?(color_id.to_i)
    end

    def existing_color_ids
      @existing_color_ids ||= Color.pluck(:id)
    end
  end
end
