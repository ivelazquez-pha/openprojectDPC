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
  # Admin-only tab for configuring the ordered list of extra work package
  # attributes shown on Kanban board cards for this Type.
  #
  # Authorization is global admin only (inherited `require_admin` from
  # BaseTabController), not the project-scoped `manage_types` permission,
  # since this setting applies globally across all boards/projects.
  class BoardCardConfigurationTabController < BaseTabController
    current_menu_item %i[edit update] do
      :types
    end

    def edit; end

    def update
      result = UpdateService.new(user: current_user, model: @type, contract_class: UpdateBoardCardConfigurationContract)
                            .call(board_card_field_ids: permitted_field_configs)

      if result.success?
        redirect_to edit_type_board_card_configuration_path(type_id: @type.id), notice: I18n.t(:notice_successful_update)
      else
        render :edit, status: :unprocessable_entity
      end
    end

    private

    # Each row of the admin form submits a Hash (`field_id`, `zone`,
    # `color_id`, `background_color_id`, `show_label`) rather than a bare
    # identifier -- see `Type::BoardCardConfiguration` for the shape this
    # feeds into. Rows with no field selected (the always-present blank row
    # the form renders when nothing else is configured, or a freshly
    # JS-added row the admin never filled in) are dropped here rather than
    # rejected by the contract, since "not configured" is a valid intent.
    def permitted_field_configs
      form_params
        .permit(board_card_field_ids: %i[field_id zone color_id background_color_id show_label])
        .to_h
        .fetch("board_card_field_ids", [])
        .reject { |entry| entry["field_id"].blank? }
    end

    def form_params
      params[:work_package_types_forms_board_card_configuration_form_model] || ActionController::Parameters.new
    end
  end
end
