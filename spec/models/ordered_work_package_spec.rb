# frozen_string_literal: true

require "rails_helper"

RSpec.describe OrderedWorkPackage do
  subject { build(:ordered_work_package) }

  describe "validations" do
    it "is valid with query, work package and position" do
      expect(subject).to be_valid
    end

    describe "composite (query, work package) uniqueness" do
      let(:query) { create(:query) }
      let(:work_package) { create(:work_package) }
      let!(:existing) do
        create(:ordered_work_package, query:, work_package:, position: 0)
      end

      it "rejects a duplicate (query_id, work_package_id) pair at the model level" do
        duplicate = build(:ordered_work_package, query:, work_package:, position: 1)

        expect(duplicate).to be_invalid
        expect(duplicate.errors[:work_package_id]).to be_present
      end

      it "raises a friendly ActiveRecord::RecordInvalid instead of a raw database error" do
        duplicate = build(:ordered_work_package, query:, work_package:, position: 1)

        expect { duplicate.save! }.to raise_error(ActiveRecord::RecordInvalid)
      end

      it "still allows updating the existing row's position (Release A upsert compatibility)" do
        existing.reload.update!(position: 42)

        expect(existing.reload.position).to eq 42
        expect(query.ordered_work_packages.where(work_package_id: work_package.id).count).to eq 1
      end
    end
  end
end
