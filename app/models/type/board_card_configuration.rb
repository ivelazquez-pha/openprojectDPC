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
# Stores an ordered list of per-field configuration entries to render as
# extra rows on Kanban board cards for work packages of this type. This is a
# global, admin-only setting (no per-board or per-user override).
#
# Each stored entry is either:
#   - a plain String field id (the original, pre-styling format: e.g.
#     `"priority"`) — kept working forever so existing configurations keep
#     rendering exactly as before (zone "middle", no color override, label
#     shown), or
#   - a Hash with a `"field_id"` key plus optional `"zone"`, `"color_id"`,
#     `"background_color_id"`, `"show_label"`, `"bold"` keys.
#
# Normalization: a configured field id that is no longer a valid work
# package attribute for this type (e.g. a deleted custom field, or a
# constraint added by a plugin) is silently dropped so that stale
# configuration can never cause a rendering failure. The stored raw value is
# left untouched until the admin saves the form again (at which point the
# contract only accepts currently-valid identifiers).
class Type::BoardCardConfiguration
  # `"date"` is a genuine work package API attribute, but only ever rendered
  # for Milestone-type work packages (see
  # `lib/api/v3/work_packages/work_package_representer.rb`'s `date_property
  # :date`). Board card configuration is not milestone-aware, so `"date"` is
  # never treated as available here; `start_date`/`due_date` (offered via
  # `merge_date: false`) already cover the general case.
  MILESTONE_ONLY_DATE_ATTRIBUTE = "date"

  # Where a field's `label: value` row renders relative to the card's fixed
  # baseline layout (see `wp-single-card.component.sass`'s grid areas):
  # above the subject line, below the cover image (the original, and still
  # default, placement), or below the assignee/dates footer row.
  ZONES = %w[top middle footer].freeze
  DEFAULT_ZONE = "middle"

  FieldConfig = Struct.new(:field_id, :zone, :color_id, :background_color_id, :show_label, :bold, keyword_init: true) do
    def color
      self.class.hexcode_for(color_id)
    end

    def background_color
      self.class.hexcode_for(background_color_id)
    end

    # Resolves a `Color#id` to its `hexcode` via a request-wide id => hexcode
    # map, fetched once regardless of how many Types/fields are rendered in
    # this request (e.g. the Kanban board's global `GET /api/v3/types`
    # fetch, which builds a `FieldConfig` per configured field of every
    # visible Type) — avoids the N+1 that a per-field `Color.find` would
    # cause. The `colors` table is a small, admin-managed palette, so
    # caching it for the lifetime of a single request is safe.
    def self.hexcode_for(color_id)
      return nil if color_id.blank?

      color_hexcodes_by_id[color_id]
    end

    def self.color_hexcodes_by_id
      RequestStore.fetch(:board_card_configuration_color_hexcodes) { Color.pluck(:id, :hexcode).to_h }
    end
  end
  private_constant :FieldConfig

  def initialize(type)
    @type = type
  end

  ##
  # The effective, ordered list of field identifiers to render on board
  # cards for this type, with any no-longer-available identifiers removed.
  def field_ids
    field_configs.map(&:field_id)
  end

  ##
  # The effective, ordered list of per-field render configuration for this
  # type (id, zone, resolved colors, whether to show the label), with any
  # no-longer-available identifiers removed and duplicates collapsed to
  # their first occurrence — same semantics `field_ids` always had, just
  # carrying the extra styling data needed to render each row.
  def field_configs
    @field_configs ||= configured
                        .filter_map { |entry| normalize(entry) }
                        .uniq(&:field_id)
                        .select { |config| available_field_ids.include?(config.field_id) }
  end

  ##
  # The identifiers of every work package attribute currently selectable as a
  # board card field for this type, in the API v3 camelCase format (e.g.
  # `startDate`, `customField1`) that the `UpdateBoardCardConfigurationContract`
  # validation relies on, so that the same set of identifiers is offered,
  # validated, and stored everywhere.
  def available_field_ids
    available_attributes.map(&:last)
  end

  ##
  # `[display_name, api_key]` pairs for every work package attribute
  # currently selectable as a board card field for this type. The single
  # source of truth also used by `available_field_ids`, so the admin picker
  # (`BoardCardConfigurationComponent#available_attributes`), the stored
  # value, and the contract validation always agree on exactly which
  # identifiers, and in which format, are selectable.
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
  def available_attributes
    @available_attributes ||= @type
      .work_package_attributes(merge_date: false)
      .reject { |key, _| key == MILESTONE_ONLY_DATE_ATTRIBUTE }
      .select { |key, _| available_custom_field_key?(key) }
      .map { |key, attr| [Type.translated_attribute_name(key, attr), API::Utilities::PropertyNameConverter.from_ar_name(key)] }
  end

  private

  def configured
    Array(@type.board_card_field_ids)
  end

  def normalize(entry)
    case entry
    when String
      FieldConfig.new(field_id: entry, zone: DEFAULT_ZONE, color_id: nil, background_color_id: nil, show_label: true, bold: false)
    when Hash
      normalize_hash(entry)
    end
  end

  def normalize_hash(entry)
    entry = entry.stringify_keys
    field_id = entry["field_id"]
    return nil if field_id.blank?

    FieldConfig.new(
      field_id:,
      zone: ZONES.include?(entry["zone"]) ? entry["zone"] : DEFAULT_ZONE,
      color_id: entry["color_id"].presence&.to_i,
      background_color_id: entry["background_color_id"].presence&.to_i,
      # The admin form submits this as the HTML string "0"/"1" (a checkbox
      # paired with a hidden fallback field), not a real boolean -- `!!`
      # would treat BOTH as truthy and always resolve to `true`. Cast
      # through ActiveModel::Type::Boolean, which handles "0"/"1"/true/false
      # uniformly, so both HTML form submissions and any real boolean
      # (e.g. a JSON API caller) behave the same.
      show_label: entry.key?("show_label") ? ActiveModel::Type::Boolean.new.cast(entry["show_label"]) : true,
      bold: entry.key?("bold") ? ActiveModel::Type::Boolean.new.cast(entry["bold"]) : false
    )
  end

  # CONFIRMED BUG FIX: `Type#work_package_attributes` lists EVERY
  # `WorkPackageCustomField` in the system, regardless of whether it is
  # actually associated with this Type (`Type#custom_fields`) — its
  # project-scoped constraint check is only exercised when a `project:` is
  # given, and no project is ever passed in this admin-form context. Plain,
  # non-custom-field attributes (assignee, dates, category, etc.) are
  # unaffected and always pass through.
  def available_custom_field_key?(key)
    return true unless CustomField.custom_field_attribute?(key)

    associated_custom_field_ids.include?(custom_field_id_from_key(key))
  end

  # `custom_field_ids` (the standard HABTM ids accessor, already used the
  # same way in `Type::Attributes#active_custom_field_attributes`) correctly
  # reflects in-memory-assigned associations on unsaved/new `Type` records
  # too (e.g. `build(:type, custom_fields: [cf])` in specs), unlike querying
  # `@type.custom_fields` directly, which would issue a DB lookup scoped to
  # the (nil, for a new record) owner id and always come back empty.
  def associated_custom_field_ids
    @associated_custom_field_ids ||= @type.custom_field_ids
  end

  def custom_field_id_from_key(key)
    key[/\Acustom_field_(\d+)\z/, 1].to_i
  end
end
