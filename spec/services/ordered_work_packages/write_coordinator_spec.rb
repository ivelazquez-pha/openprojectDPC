# frozen_string_literal: true

require "rails_helper"

RSpec.describe OrderedWorkPackages::WriteCoordinator do
  let(:query) { create(:query) }
  let(:work_package) { create(:work_package) }
  let(:other_work_package) { create(:work_package) }

  describe ".write_positions" do
    it "creates a new ordered_work_package row for a work package without one" do
      described_class.write_positions(query:, positions: { work_package.id => 3 })

      record = query.ordered_work_packages.find_by(work_package_id: work_package.id)
      expect(record.position).to eq 3
    end

    it "updates the position of an existing row instead of creating a duplicate" do
      create(:ordered_work_package, query:, work_package:, position: 0)

      described_class.write_positions(query:, positions: { work_package.id => 7 })

      expect(query.ordered_work_packages.where(work_package_id: work_package.id).count).to eq 1
      expect(query.ordered_work_packages.find_by(work_package_id: work_package.id).position).to eq 7
    end

    it "writes multiple pairs in a single call" do
      described_class.write_positions(query:, positions: { work_package.id => 0, other_work_package.id => 1 })

      expect(query.ordered_work_packages.find_by(work_package_id: work_package.id).position).to eq 0
      expect(query.ordered_work_packages.find_by(work_package_id: other_work_package.id).position).to eq 1
    end

    it "removes the row when the position is -1 (legacy QueryOrderAPI removal signal)" do
      create(:ordered_work_package, query:, work_package:, position: 0)

      described_class.write_positions(query:, positions: { work_package.id => -1 })

      expect(query.ordered_work_packages.where(work_package_id: work_package.id)).to be_empty
    end

    it "removes the row when the position is nil" do
      create(:ordered_work_package, query:, work_package:, position: 0)

      described_class.write_positions(query:, positions: { work_package.id => nil })

      expect(query.ordered_work_packages.where(work_package_id: work_package.id)).to be_empty
    end

    it "is a no-op when asked to remove a row that does not exist" do
      expect do
        described_class.write_positions(query:, positions: { work_package.id => -1 })
      end.not_to raise_error
    end

    context "when a concurrent writer races the preload (Release A compatibility)" do
      it "recovers from a real unique-constraint conflict by updating the existing row" do
        existing = create(:ordered_work_package, query:, work_package:, position: 0)

        coordinator = described_class.new(query)
        # Simulate a race: another process inserts the competing row after our
        # preload ran, so our own INSERT hits the live composite unique index
        # instead of finding the row via the preloaded cache.
        allow(coordinator).to receive(:preload_existing).and_return({})

        expect do
          coordinator.write_positions(work_package.id => 99)
        end.not_to raise_error

        expect(existing.reload.position).to eq 99
        expect(query.ordered_work_packages.where(work_package_id: work_package.id).count).to eq 1
      end
    end
  end
end
