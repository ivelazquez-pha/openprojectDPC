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

require "spec_helper"

RSpec.describe Type::BoardCardConfiguration do
  let(:type) { build(:type) }

  subject(:configuration) { described_class.new(type) }

  before do
    # Clear up the request store cache for all_work_package_attributes
    RequestStore.clear!
  end

  describe "#field_ids" do
    context "when nothing is configured" do
      it "is empty" do
        expect(configuration.field_ids).to eq([])
      end
    end

    context "when the stored value is nil" do
      before do
        type.board_card_field_ids = nil
      end

      it "is empty, never raising" do
        expect(configuration.field_ids).to eq([])
      end
    end

    context "when valid attributes are configured" do
      before do
        type.board_card_field_ids = %w[priority assignee]
      end

      it "returns them in the configured order" do
        expect(configuration.field_ids).to eq(%w[priority assignee])
      end
    end

    context "when a configured identifier is no longer a valid work package attribute" do
      before do
        type.board_card_field_ids = %w[priority not_a_real_attribute assignee]
      end

      it "silently drops the stale identifier, preserving order of the rest" do
        expect(configuration.field_ids).to eq(%w[priority assignee])
      end
    end

    context "when the same identifier is configured twice" do
      before do
        type.board_card_field_ids = %w[priority priority assignee]
      end

      it "de-duplicates" do
        expect(configuration.field_ids).to eq(%w[priority assignee])
      end
    end

    # POST-DEPLOY BUG FIX: the merged "date" pseudo-attribute must never be
    # treated as available; the real start_date/due_date identifiers (in API
    # camelCase format) must be available instead.
    context "when startDate/dueDate (API camelCase) are configured" do
      before do
        type.board_card_field_ids = %w[startDate dueDate]
      end

      it "keeps both, not the merged 'date' pseudo-key" do
        expect(configuration.field_ids).to eq(%w[startDate dueDate])
      end
    end

    context "when the merged 'date' pseudo-key is (stale-)configured" do
      before do
        type.board_card_field_ids = %w[date priority]
      end

      it "drops it as unavailable, since it is not a real work package attribute" do
        expect(configuration.field_ids).to eq(%w[priority])
      end
    end

    # POST-DEPLOY BUG FIX: custom field identifiers must be available in API
    # camelCase format (customField<id>), not the Rails-internal snake_case
    # format (custom_field_<id>).
    context "when a custom field is configured in API camelCase format" do
      let(:custom_field) { create(:work_package_custom_field) }
      let(:type) { build(:type, custom_fields: [custom_field]) }

      before do
        type.board_card_field_ids = ["customField#{custom_field.id}"]
      end

      it "is available and kept" do
        expect(configuration.field_ids).to eq(["customField#{custom_field.id}"])
      end
    end

    context "when a custom field is configured in the old snake_case format" do
      let(:custom_field) { create(:work_package_custom_field) }
      let(:type) { build(:type, custom_fields: [custom_field]) }

      before do
        type.board_card_field_ids = ["custom_field_#{custom_field.id}"]
      end

      it "drops it as unavailable (wrong format is treated as stale)" do
        expect(configuration.field_ids).to eq([])
      end
    end
  end

  # CONFIRMED BUG FIX: `available_field_ids` (the single source of truth
  # shared by the admin picker, the contract validation, and `field_ids`
  # above) previously listed EVERY `WorkPackageCustomField` in the entire
  # system as available for EVERY Type, regardless of whether the custom
  # field was actually associated with that Type (`Type#custom_fields`).
  # This happened because `Type#work_package_attributes` only checks the
  # custom-field-in-project constraint when a `project:` is given, and no
  # project is ever passed in this admin-form context, so that check was
  # always skipped entirely — `Type#custom_fields` was never consulted here.
  describe "#available_field_ids" do
    context "when a custom field exists in the system but is NOT associated with this type" do
      let(:unassociated_custom_field) { create(:work_package_custom_field) }
      let(:type) { build(:type) }

      before do
        # Force the custom field to exist before computing available_field_ids.
        unassociated_custom_field
      end

      it "is not offered as an available field" do
        expect(configuration.available_field_ids).not_to include("customField#{unassociated_custom_field.id}")
      end
    end

    context "when a custom field IS associated with this type" do
      let(:associated_custom_field) { create(:work_package_custom_field) }
      let(:type) { build(:type, custom_fields: [associated_custom_field]) }

      it "is offered as an available field" do
        expect(configuration.available_field_ids).to include("customField#{associated_custom_field.id}")
      end
    end

    it "still includes plain, non-custom-field attributes regardless of the type's custom_fields association" do
      expect(configuration.available_field_ids).to include("priority")
    end
  end
end
