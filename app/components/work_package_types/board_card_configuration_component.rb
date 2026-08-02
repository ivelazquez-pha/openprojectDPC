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

    # `[display_name, api_key]` pairs -- the same list `Type::BoardCardConfiguration`
    # validates/stores against, used to populate every row's field picker.
    def available_attributes
      model.board_card_fields.available_attributes
    end

    # `[human_label, "top"|"middle"|"footer"]` pairs for the zone picker.
    def zone_options
      Type::BoardCardConfiguration::ZONES.map do |zone|
        [I18n.t("types.edit.board_card_configuration.zones.#{zone}"), zone]
      end
    end

    # `[name, id]` pairs for the two color pickers -- the same app-wide
    # `Color` palette already used for `Type#color_id`
    # (`app/forms/work_package_types/settings_form.rb`), so board card field
    # colors stay consistent with every other admin-configurable color in
    # OpenProject instead of introducing free-form hex input.
    def color_options
      Color.order(:name).pluck(:name, :id)
    end

    # The `name=` prefix every row's inputs are submitted under, e.g.
    # `work_package_types_forms_board_card_configuration_form_model[board_card_field_ids]`
    # -- derived from `board_card_form_object`'s own `model_name.param_key`,
    # the SAME derivation `settings_primer_form_with(model: board_card_form_object, ...)`
    # already uses to scope the form, so this can never drift out of sync
    # with what `BoardCardConfigurationTabController` reads back on submit.
    def form_field_name
      "#{board_card_form_object.model_name.param_key}[board_card_field_ids]"
    end

    private

    def board_card_form_object
      @board_card_form_object ||= Forms::BoardCardConfigurationFormModel.new(
        field_rows:,
        available_attributes:,
        zone_options:,
        color_options:,
        validation_errors: model.errors
      )
    end

    # One row per configured field, each a plain String-keyed Hash matching
    # `board_card_field_ids`' stored/submitted shape -- reflects the just-
    # submitted (not yet persisted) values on a validation failure re-render,
    # falling back to the persisted configuration otherwise. Always at least
    # one (possibly blank) row, so the admin always has a row to fill in and
    # the "remove" action always has something else to fall back to.
    def field_rows
      rows = submitted_field_rows || stored_field_rows
      rows.presence || [blank_row]
    end

    def stored_field_rows
      model.board_card_fields.field_configs.map do |config|
        {
          "field_id" => config.field_id,
          "zone" => config.zone,
          "color_id" => config.color_id,
          "background_color_id" => config.background_color_id,
          "show_label" => config.show_label
        }
      end
    end

    def submitted_field_rows
      return nil if @board_card_form_data.blank?

      # `@board_card_form_data` is the raw, unpermitted `params` slice on a
      # validation-failure re-render (see `board_card_configuration_tab/edit.html.erb`)
      # -- `to_h` on an unpermitted `ActionController::Parameters` raises.
      # `to_unsafe_h` is safe here: this is read-only redisplay of the
      # user's own just-submitted input, never written back to the model
      # from this path (persistence already went through the real,
      # strong-parameter-permitted `BoardCardConfigurationTabController#permitted_field_configs`).
      Array(@board_card_form_data[:board_card_field_ids]).map do |entry|
        entry.respond_to?(:to_unsafe_h) ? entry.to_unsafe_h : entry.to_h
      end
    end

    def blank_row
      {
        "field_id" => nil,
        "zone" => Type::BoardCardConfiguration::DEFAULT_ZONE,
        "color_id" => nil,
        "background_color_id" => nil,
        "show_label" => true
      }
    end
  end
end
