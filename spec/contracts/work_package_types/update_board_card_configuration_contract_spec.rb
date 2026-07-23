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

module WorkPackageTypes
  RSpec.describe UpdateBoardCardConfigurationContract do
    let(:model) { create(:type) }
    let(:user) { create(:admin) }

    subject(:contract) { described_class.new(model, user) }

    before do
      # Clear up the request store cache for all_work_package_attributes
      RequestStore.clear!
    end

    context "when the user isn't admin" do
      let(:user) { create(:user) }

      it "the contract is invalid" do
        expect(contract.validate).to be_falsey
      end

      it "adds an error to the contract" do
        contract.validate
        expect(contract.errors.details).to eq(base: [{ error: :error_unauthorized }])
      end
    end

    context "when no field ids are configured" do
      it "is valid" do
        expect(contract.validate).to be_truthy
      end
    end

    context "when valid work package attribute identifiers are configured" do
      before do
        model.board_card_field_ids = %w[priority assignee]
      end

      it "is valid" do
        expect(contract.validate).to be_truthy
      end
    end

    context "when an unknown identifier is submitted" do
      before do
        model.board_card_field_ids = %w[priority not_a_real_attribute]
      end

      it "is invalid" do
        expect(contract.validate).to be_falsey
      end

      it "adds an error on board_card_field_ids" do
        contract.validate
        expect(contract.errors.details).to eq(board_card_field_ids: [{ error: :invalid }])
      end
    end

    context "when the submitted value is not an array" do
      before do
        model.board_card_field_ids = "priority"
      end

      it "is invalid" do
        expect(contract.validate).to be_falsey
      end
    end
  end
end
