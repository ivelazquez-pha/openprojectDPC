# frozen_string_literal: true

#-- copyright
# OpenProject is an open source project management software.
# Copyright (C) the OpenProject GmbH
#
# This program is free software; you can redistribute it and/or
# modify it under the terms of the GNU General Public License version 3.
#++

require "rails_helper"

RSpec.describe Queries::Copy::OrderedWorkPackagesDependentService do
  let(:project) { create(:project) }
  let(:user) { create(:user) }
  let(:wp1) { create(:work_package, project:) }
  let(:wp2) { create(:work_package, project:) }

  let(:source) do
    create(:query, project:, user:).tap do |q|
      q.sort_criteria = [[:manual_sorting, "asc"]]
      q.save!
    end
  end
  let(:target) { create(:query, project:, user:) }

  subject(:service) { described_class.new(source:, target:, user:) }

  before do
    source.ordered_work_packages.create!(work_package_id: wp1.id, position: 0)
    source.ordered_work_packages.create!(work_package_id: wp2.id, position: 1)
  end

  describe "#call" do
    it "copies every ordered work package to the target query" do
      result = service.call(params: {})

      expect(result).to be_success
      expect(target.ordered_work_packages.count).to eq 2
      expect(target.ordered_work_packages.find_by(work_package_id: wp1.id).position).to eq 0
      expect(target.ordered_work_packages.find_by(work_package_id: wp2.id).position).to eq 1
    end

    it "does nothing when the source query is not manually sorted" do
      source.sort_criteria = [[:id, "asc"]]
      source.save!

      result = service.call(params: {})

      expect(result).to be_success
      expect(target.ordered_work_packages).to be_empty
    end

    it "results in a single row when the target already has a row for that work package " \
       "(Release A compatibility: duplicate-safe copy, no swallowed error)" do
      target.ordered_work_packages.create!(work_package_id: wp1.id, position: 99)

      result = service.call(params: {})

      expect(result).to be_success
      expect(target.ordered_work_packages.where(work_package_id: wp1.id).count).to eq 1
      expect(target.ordered_work_packages.find_by(work_package_id: wp1.id).position).to eq 0
    end
  end
end
