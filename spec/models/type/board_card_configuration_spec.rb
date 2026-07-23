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
  end
end
