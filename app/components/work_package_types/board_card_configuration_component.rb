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
  class BoardCardConfigurationComponent < ApplicationComponent
    include ApplicationHelper
    include OpPrimer::ComponentHelpers
    include OpTurbo::Streamable

    def initialize(model, board_card_form_data: nil, **)
      @board_card_form_data = board_card_form_data
      super(model, **)
    end

    def form_options
      {
        url: type_board_card_configuration_path(type_id: model.id),
        method: :put,
        model: board_card_form_object
      }
    end

    private

    def board_card_form_object
      Forms::BoardCardConfigurationFormModel.new(
        field_ids: submitted_field_ids || model.board_card_fields.field_ids,
        available_attributes: sorted_available_attributes,
        validation_errors: model.errors
      )
    end

    def submitted_field_ids
      return nil if @board_card_form_data.blank?

      Array(@board_card_form_data[:board_card_field_ids]).reject(&:blank?)
    end

    # Fixed baseline fields that `wp-single-card.component.html` already
    # always renders for every card, regardless of `board_card_field_ids`
    # (assignee, and the combined start/due date row). Toggling these in the
    # picker has no visible effect on the card, so they are excluded from the
    # picker's option list entirely rather than shown as misleadingly
    # toggleable. `available_field_ids`/`field_ids` (the contract's own
    # validation/storage) are intentionally left untouched by this exclusion.
    FIXED_BASELINE_ATTRIBUTES = %w[assignee startDate dueDate].freeze

    # Available options are filtered down to `model.board_card_fields
    # .available_field_ids` — the single source of truth also used to
    # validate/store `board_card_field_ids` (see `Type::BoardCardConfiguration`)
    # — so the picker, the stored value, and the contract validation always
    # agree on exactly which identifiers, and in which format, are selectable.
    def sorted_available_attributes
      allowed_ids = model.board_card_fields.available_field_ids

      model
        .work_package_attributes(merge_date: false)
        .map { |key, attr| [Type.translated_attribute_name(key, attr), api_attribute_name(key)] }
        .select { |_, api_key| allowed_ids.include?(api_key) && !FIXED_BASELINE_ATTRIBUTES.include?(api_key) }
        .sort_by(&:first)
    end

    # Board card field identifiers are stored/round-tripped in the API v3
    # camelCase format (e.g. `startDate`, `customField1`) so they match the
    # frontend work package resource/schema property names directly, instead
    # of the Rails-internal snake_case attribute keys (`start_date`,
    # `custom_field_1`) that `work_package_attributes` returns.
    def api_attribute_name(key)
      API::Utilities::PropertyNameConverter.from_ar_name(key)
    end
  end
end
