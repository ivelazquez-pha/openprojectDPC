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
  module Forms
    # Backs the `work_package_types_forms_board_card_configuration_form_model`
    # param scope used by `BoardCardConfigurationTabController#update` -- not
    # an ActiveRecord model, just a plain carrier for the data the board card
    # configuration tab's view needs, so `ActiveModel::Naming` is enough to
    # give it a stable `model_name`/param key for `settings_primer_form_with`.
    class BoardCardConfigurationFormModel
      extend ActiveModel::Naming

      attr_reader :field_rows, :available_attributes, :zone_options, :color_options, :validation_errors

      def initialize(field_rows:, available_attributes:, zone_options:, color_options:, validation_errors: {})
        @field_rows = field_rows
        @available_attributes = available_attributes
        @zone_options = zone_options
        @color_options = color_options
        @validation_errors = validation_errors
      end
    end
  end
end
