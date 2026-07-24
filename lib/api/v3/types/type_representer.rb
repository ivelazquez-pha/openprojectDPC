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
        # list of extra work package attribute identifiers configured for
        # this type. Stale/no-longer-available identifiers are already
        # filtered out by Type::BoardCardConfiguration#field_ids.
        property :board_card_field_ids,
                 getter: ->(*) { board_card_fields.field_ids }

        date_time_property :created_at
        date_time_property :updated_at

        def _type
          "Type"
        end
      end
    end
  end
end
