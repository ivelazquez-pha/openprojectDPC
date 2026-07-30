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

  subject(:render_component) do
    render_inline(described_class.new(type, board_card_form_data:))
  end

  before do
    # Clear up the request store cache for all_work_package_attributes
    RequestStore.clear!
  end

  context "when no fields are configured" do
    it "renders a checkbox per available work package attribute, all unchecked" do
      render_component

      expect(page).to have_css("input[type=checkbox][value=priority]")
      expect(page.find("input[type=checkbox][value=priority]")).not_to be_checked
    end
  end

  context "when the type has previously configured fields" do
    # NOTE: uses `category` (not `assignee`) as the "second field" example,
    # since `assignee` is a fixed baseline attribute no longer offered as a
    # picker option at all — see the "fixed baseline fields" context below.
    let(:type) { create(:type, board_card_configuration: { board_card_field_ids: %w[priority category] }) }

    it "checks the configured attribute checkboxes" do
      render_component

      expect(page.find("input[type=checkbox][value=priority]")).to be_checked
      expect(page.find("input[type=checkbox][value=category]")).to be_checked
    end
  end

  context "when the component is rendered with submitted form values" do
    let(:type) { create(:type) }
    let(:board_card_form_data) { { board_card_field_ids: ["priority"] } }

    it "reflects the submitted (not-yet-persisted) selection" do
      render_component

      expect(page.find("input[type=checkbox][value=priority]")).to be_checked
      expect(page.find("input[type=checkbox][value=category]")).not_to be_checked
    end
  end

  context "when a previously configured identifier is no longer a valid attribute" do
    let(:type) { create(:type, board_card_configuration: { board_card_field_ids: %w[priority stale_removed_attribute] }) }

    it "renders without raising and does not show a checkbox for the stale identifier" do
      expect { render_component }.not_to raise_error
      expect(page).not_to have_css("input[type=checkbox][value=stale_removed_attribute]")
    end
  end

  # POST-DEPLOY BUG FIX: the merged "date" pseudo-attribute (an artifact of the
  # Type form-layout-configuration screen, where start+due date are edited as
  # a single visual row) is not a real work package attribute/schema property
  # and must never be offered as a selectable board card field.
  context "regarding the merged date pseudo-attribute (post-deploy bug fix)" do
    it "never offers the merged pseudo 'date' attribute as a selectable option" do
      render_component

      expect(page).not_to have_css("input[type=checkbox][value=date]")
    end

    # NOTE: startDate/dueDate's camelCase resolution itself is still covered
    # at the model level (spec/models/type/board_card_configuration_spec.rb).
    # They are no longer offered as picker *options* here at all — see the
    # "fixed baseline fields" context below: this admin picker's own fixed
    # baseline (assignee/startDate/dueDate) already always renders on every
    # card regardless of configuration, so toggling them had no effect.
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

      expect(page).to have_css("input[type=checkbox][value=customField#{custom_field.id}]")
      expect(page).not_to have_css("input[type=checkbox][value=custom_field_#{custom_field.id}]")
    end
  end

  # CONFIRMED BUG FIX: previously every WorkPackageCustomField in the system
  # was offered as a checkable option for every Type, regardless of whether it
  # was actually associated with that Type (Type#custom_fields). Only custom
  # fields actually associated with this Type should be offered.
  context "regarding custom fields not associated with this type (confirmed bug fix)" do
    let(:associated_custom_field) { create(:work_package_custom_field) }
    let(:unassociated_custom_field) { create(:work_package_custom_field) }
    let(:type) { create(:type, custom_fields: [associated_custom_field]) }

    before do
      unassociated_custom_field
    end

    it "offers the associated custom field" do
      render_component

      expect(page).to have_css("input[type=checkbox][value=customField#{associated_custom_field.id}]")
    end

    it "does not offer the unassociated custom field" do
      render_component

      expect(page).not_to have_css("input[type=checkbox][value=customField#{unassociated_custom_field.id}]")
    end
  end

  # CONFIRMED, USER-DECIDED BEHAVIOR: the fixed baseline fields the card
  # already always renders regardless of board_card_field_ids (assignee,
  # startDate, dueDate) are removed from the picker's option list entirely,
  # since toggling them has no visible effect on the card.
  context "regarding the fixed baseline fields (confirmed, user-decided)" do
    it "does not offer assignee as a selectable option" do
      render_component

      expect(page).not_to have_css("input[type=checkbox][value=assignee]")
    end

    it "does not offer startDate as a selectable option" do
      render_component

      expect(page).not_to have_css("input[type=checkbox][value=startDate]")
    end

    it "does not offer dueDate as a selectable option" do
      render_component

      expect(page).not_to have_css("input[type=checkbox][value=dueDate]")
    end

    it "still offers other plain attributes such as priority" do
      render_component

      expect(page).to have_css("input[type=checkbox][value=priority]")
    end
  end
end
