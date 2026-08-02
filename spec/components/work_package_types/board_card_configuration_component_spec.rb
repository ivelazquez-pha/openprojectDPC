# frozen_string_literal: true

# -- copyright
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
# ++

require "rails_helper"

RSpec.describe WorkPackageTypes::BoardCardConfigurationComponent, type: :component do
  let(:type) { create(:type) }
  let(:board_card_form_data) { nil }
  let(:name_prefix) { "work_package_types_forms_board_card_configuration_form_model[board_card_field_ids]" }

  subject(:render_component) do
    render_inline(described_class.new(type, board_card_form_data:))
  end

  before do
    # Clear up the request store cache for all_work_package_attributes
    RequestStore.clear!
  end

  def field_select(index)
    page.find("select[name='#{name_prefix}[#{index}][field_id]']")
  end

  def zone_select(index)
    page.find("select[name='#{name_prefix}[#{index}][zone]']")
  end

  def show_label_checkbox(index)
    page.find("input[type=checkbox][name='#{name_prefix}[#{index}][show_label]']")
  end

  context "when no fields are configured" do
    it "renders a single row with no field preselected" do
      render_component

      expect(page).to have_css("tr.board-card-configuration-row", count: 1)
      expect(field_select(0).value).to be_blank
    end

    it "defaults the blank row to the middle zone, shown, with no color override" do
      render_component

      expect(zone_select(0).value).to eq("middle")
      expect(show_label_checkbox(0)).to be_checked
    end
  end

  context "when the type has previously configured fields (legacy flat string format)" do
    let(:type) { create(:type, board_card_configuration: { board_card_field_ids: %w[priority assignee] }) }

    it "renders one row per configured field, preselected, defaulting to the middle zone" do
      render_component

      expect(page).to have_css("tr.board-card-configuration-row", count: 2)
      expect(field_select(0).value).to eq("priority")
      expect(zone_select(0).value).to eq("middle")
      expect(field_select(1).value).to eq("assignee")
    end
  end

  context "when the type has previously configured fields (rich per-field format)" do
    let(:type) do
      create(:type, board_card_configuration: {
               board_card_field_ids: [{ "field_id" => "priority", "zone" => "top", "show_label" => false }]
             })
    end

    it "preselects the configured zone and reflects show_label" do
      render_component

      expect(zone_select(0).value).to eq("top")
      expect(show_label_checkbox(0)).not_to be_checked
    end
  end

  context "when the component is rendered with submitted form values" do
    let(:board_card_form_data) do
      { board_card_field_ids: [{ "field_id" => "assignee", "zone" => "footer" }] }
    end

    it "reflects the submitted (not-yet-persisted) row, not the persisted configuration" do
      render_component

      expect(field_select(0).value).to eq("assignee")
      expect(zone_select(0).value).to eq("footer")
    end
  end

  context "when a previously configured identifier is no longer a valid attribute" do
    let(:type) { create(:type, board_card_configuration: { board_card_field_ids: %w[priority stale_removed_attribute] }) }

    it "renders without raising and does not offer the stale identifier as an option" do
      expect { render_component }.not_to raise_error
      expect(field_select(0)).not_to have_css("option[value=stale_removed_attribute]")
    end
  end

  # POST-DEPLOY BUG FIX: the merged "date" pseudo-attribute (an artifact of the
  # Type form-layout-configuration screen, where start+due date are edited as
  # a single visual row) is not a real work package attribute/schema property
  # and must never be offered as a selectable board card field.
  context "regarding the merged date pseudo-attribute (post-deploy bug fix)" do
    it "never offers the merged pseudo 'date' attribute as a field option" do
      render_component

      expect(field_select(0)).not_to have_css("option[value=date]")
    end

    it "offers the real start_date and due_date attributes separately, in API camelCase format" do
      render_component

      expect(field_select(0)).to have_css("option[value=startDate]")
      expect(field_select(0)).to have_css("option[value=dueDate]")
    end
  end

  # POST-DEPLOY BUG FIX: custom field keys must be offered in the API v3
  # camelCase format (customField<id>), matching the format the frontend's
  # work package schema/resource actually uses, not the Rails-internal
  # snake_case format (custom_field_<id>).
  context "regarding custom field key format (post-deploy bug fix)" do
    let(:custom_field) { create(:work_package_custom_field) }
    let(:type) { create(:type, custom_fields: [custom_field]) }

    it "offers the custom field in API camelCase format, not the internal snake_case key" do
      render_component

      expect(field_select(0)).to have_css("option[value=customField#{custom_field.id}]")
      expect(field_select(0)).not_to have_css("option[value=custom_field_#{custom_field.id}]")
    end
  end

  it "offers the app-wide Color palette for the text/background color pickers" do
    color = create(:color, name: "Distinctive color name")
    render_component

    color_select = page.find("select[name='#{name_prefix}[0][color_id]']")
    expect(color_select).to have_css("option", text: color.name)
  end

  it "scopes row add/remove interactivity to the admin--board-card-configuration Stimulus controller" do
    render_component

    expect(page).to have_css("[data-controller='admin--board-card-configuration']")
  end
end
