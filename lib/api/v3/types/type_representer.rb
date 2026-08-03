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

module API
  module V3
    module Types
      class TypeRepresenter < ::API::Decorators::Single
        include API::Decorators::DateProperty
        include ::API::Caching::CachedRepresenter

        self_link

        property :id
        property :name
        property :color,
                 getter: ->(*) { color.hexcode if color },
                 render_nil: true
        property :position
        property :is_default
        property :is_milestone

        # Board-only Kanban card field configuration: an ordered, read-only
        # list of extra work package attribute rows configured for this
        # type, each with the zone it renders in (top/middle/footer),
        # resolved color/backgroundColor (hex, or nil for "use the default
        # styling"), and whether to render the "label:" prefix. Stale/
        # no-longer-available identifiers are already filtered out by
        # Type::BoardCardConfiguration#field_configs.
        property :board_card_fields,
                 getter: ->(*) {
                   board_card_fields.field_configs.map do |config|
                     {
                       fieldId: config.field_id,
                       zone: config.zone,
                       color: config.color,
                       backgroundColor: config.background_color,
                       showLabel: config.show_label,
                       bold: config.bold
                     }
                   end
                 }

        # Per-Type override for the label shown on a work package's
        # full/detail view "combined date" trigger (the compact summary that
        # opens the scheduling modal). This is the SAME setting already used
        # by WorkPackageSchemaRepresenter's `schema :due_date` `name_source:`
        # -- blank/nil means "use the standard translated label". Read-only.
        property :due_date_label,
                 getter: ->(*) { due_date_label.presence },
                 render_nil: true

        date_time_property :created_at
        date_time_property :updated_at

        def _type
          "Type"
        end
      end
    end
  end
end
