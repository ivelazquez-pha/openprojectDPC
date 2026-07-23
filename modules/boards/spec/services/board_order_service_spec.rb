# frozen_string_literal: true

#-- copyright
# OpenProject is an open source project management software.
# Copyright (C) the OpenProject GmbH
#
# This program is free software; you can redistribute it and/or
# modify it under the terms of the GNU General Public License version 3.
#++

require "rails_helper"

RSpec.describe Boards::BoardOrderService do
  let(:project) { create(:project) }
  let(:user) do
    create(:user,
           member_with_permissions: { project => %i[show_board_views view_work_packages edit_work_packages] })
  end
  let(:board) { create(:board_grid, project:) }

  # Query::Results#work_packages applies `.visible` with no explicit user
  # argument, which defaults to User.current (not the user: kwarg we pass
  # into the service). In production this is kept in sync by the request
  # middleware; in this plain service spec we have to set it ourselves.
  before do
    User.current = user
  end

  after do
    User.current = User.anonymous
  end

  def add_column(query, column:)
    create(:grid_widget,
           grid: board,
           identifier: "work_package_query",
           start_row: 1,
           end_row: 2,
           start_column: column,
           end_column: column,
           options: { "queryId" => query.id })
  end

  def plain_query(name: "Column")
    create(:public_query, project:, name:)
  end

  # Mirrors how real Kanban board columns establish membership: the
  # manual_sort filter's effective set is exactly the work packages that
  # already have an ordered_work_packages row for that query.
  def manual_sort_query(name: "Column")
    create(:public_query, project:, name:).tap do |q|
      q.sort_criteria = [[:manual_sorting, "asc"]]
      q.add_filter(:manual_sort, "ow", [])
      q.save!
    end
  end

  def add_to_column(query, work_package, position:)
    create(:ordered_work_package, query:, work_package:, position:)
  end

  subject(:result) do
    described_class.call(user:, board:, field:, direction:, max_cards:)
  end

  let(:field) { "due_date" }
  let(:direction) { "asc" }
  # Overridden to a small number in the boundary tests below so we don't need
  # to create hundreds of work packages to exercise the exact same "N vs N+1"
  # logic that runs against the real default of 500 in production.
  let(:max_cards) { Boards::BoardOrderService::MAX_CARDS }

  describe "sorting within a single column" do
    let(:query) { plain_query }
    let!(:widget) { add_column(query, column: 1) }

    let!(:no_date) { create(:work_package, project:, due_date: nil) }
    let!(:later) { create(:work_package, project:, due_date: Date.current + 10) }
    let!(:earlier) { create(:work_package, project:, due_date: Date.current + 1) }

    it "sorts ascending with nulls last, then by id as the final tiebreaker" do
      expect(result).to be_success

      ordered_ids = query.ordered_work_packages.reload.order(:position).pluck(:work_package_id)
      expect(ordered_ids).to eq [earlier.id, later.id, no_date.id]
    end

    context "descending direction" do
      let(:direction) { "desc" }

      it "still sorts nulls last (not first, which would be the Postgres default for desc)" do
        expect(result).to be_success

        ordered_ids = query.ordered_work_packages.reload.order(:position).pluck(:work_package_id)
        expect(ordered_ids).to eq [later.id, earlier.id, no_date.id]
      end
    end
  end

  describe "respecting each column's existing filters" do
    # Uses the same manual_sort filter real board columns rely on: membership
    # is exactly the work packages that already have an ordered_work_packages
    # row for this query. excluded_wp is deliberately never added, proving
    # the sort does not bypass/expand the column's existing filtered set.
    let(:query) { manual_sort_query }
    let!(:widget) { add_column(query, column: 1) }

    let!(:included_wp) { create(:work_package, project:, due_date: Date.current + 5) }
    let!(:excluded_wp) { create(:work_package, project:, due_date: Date.current + 1) }

    before do
      add_to_column(query, included_wp, position: 0)
    end

    it "only writes positions for work packages matching the column's existing filter" do
      expect(result).to be_success

      expect(query.ordered_work_packages.reload.pluck(:work_package_id)).to eq [included_wp.id]
      expect(query.ordered_work_packages.find_by(work_package_id: excluded_wp.id)).to be_nil
    end
  end

  describe "multiple columns" do
    let(:query_a) { manual_sort_query(name: "A") }
    let(:query_b) { manual_sort_query(name: "B") }
    let!(:widget_a) { add_column(query_a, column: 1) }
    let!(:widget_b) { add_column(query_b, column: 2) }

    let!(:wp_a1) { create(:work_package, project:, due_date: Date.current + 2) }
    let!(:wp_a2) { create(:work_package, project:, due_date: Date.current + 1) }
    let!(:wp_b1) { create(:work_package, project:, due_date: Date.current + 9) }

    before do
      add_to_column(query_a, wp_a1, position: 0)
      add_to_column(query_a, wp_a2, position: 1)
      add_to_column(query_b, wp_b1, position: 0)
    end

    it "writes new positions for every column atomically" do
      expect(result).to be_success

      expect(query_a.ordered_work_packages.reload.order(:position).pluck(:work_package_id))
        .to eq [wp_a2.id, wp_a1.id]
      expect(query_b.ordered_work_packages.reload.order(:position).pluck(:work_package_id))
        .to eq [wp_b1.id]
    end
  end

  describe "board and query authorization" do
    let(:query) { plain_query }
    let!(:widget) { add_column(query, column: 1) }
    let!(:work_package) { create(:work_package, project:) }

    context "when the user has neither show_board_views nor manage_board_views" do
      let(:user) { create(:user, member_with_permissions: { project => [:view_work_packages] }) }

      it "fails as unauthorized without writing anything" do
        expect(result).to be_failure
        expect(result.result).to eq :unauthorized
        expect(query.ordered_work_packages.reload).to be_empty
      end
    end

    context "when the user has manage_board_views (not show_board_views)" do
      let(:user) do
        create(:user, member_with_permissions: { project => %i[manage_board_views view_work_packages
                                                                 edit_work_packages] })
      end

      it "succeeds because visibility is granted by show OR manage" do
        expect(result).to be_success
      end
    end

    context "when the user can view the board but cannot reorder the query" do
      let(:user) { create(:user, member_with_permissions: { project => %i[show_board_views view_work_packages] }) }

      it "fails as unauthorized without writing anything" do
        expect(result).to be_failure
        expect(result.result).to eq :unauthorized
        expect(query.ordered_work_packages.reload).to be_empty
      end
    end
  end

  describe "sortable field intersection" do
    let(:query_a) { plain_query(name: "A") }
    let(:query_b) { plain_query(name: "B") }
    let!(:widget_a) { add_column(query_a, column: 1) }
    let!(:widget_b) { add_column(query_b, column: 2) }

    let(:field) { "assigned_to" }

    it "rejects a field that is not a plain, cross-column sortable attribute" do
      expect(result).to be_failure
      expect(result.result).to eq :invalid_field
    end

    context "with an unknown field name" do
      let(:field) { "not_a_real_field" }

      it "rejects it as invalid" do
        expect(result).to be_failure
        expect(result.result).to eq :invalid_field
      end
    end
  end

  describe "the total canvas limit (exercised with a small max_cards for test speed - " \
           "identical N vs N+1 logic as the real 500 default)" do
    let(:query) { plain_query }
    let!(:widget) { add_column(query, column: 1) }
    let(:max_cards) { 3 }

    context "when the column has exactly max_cards visible cards" do
      let!(:work_packages) { create_list(:work_package, 3, project:) }

      it "sorts and commits normally" do
        expect(result).to be_success
        expect(query.ordered_work_packages.reload.count).to eq 3
      end
    end

    context "when the effective canvas totals max_cards + 1 or more" do
      let!(:work_packages) { create_list(:work_package, 4, project:) }

      it "rejects the whole command with zero writes" do
        expect(result).to be_failure
        expect(result.result).to eq :limit_exceeded
        expect(query.ordered_work_packages.reload).to be_empty
      end
    end
  end

  describe "final-column rollback" do
    let(:query_a) { manual_sort_query(name: "A") }
    let(:query_b) { manual_sort_query(name: "B") }
    let!(:widget_a) { add_column(query_a, column: 1) }
    let!(:widget_b) { add_column(query_b, column: 2) }
    let(:max_cards) { 3 }

    # Column 1 (canonical-order first) is small and valid; column 2 is
    # oversized. This proves a later column exceeding the limit rolls back
    # positions that would otherwise have been staged for an earlier one.
    # Every row starts at the same sentinel position (99) so we can tell a
    # rewrite from a no-op.
    let!(:small_column) { create_list(:work_package, 1, project:) }
    let!(:oversized_column) { create_list(:work_package, 4, project:) }

    before do
      small_column.each { |wp| add_to_column(query_a, wp, position: 99) }
      oversized_column.each { |wp| add_to_column(query_b, wp, position: 99) }
    end

    it "leaves every column's positions unchanged when a later column exceeds the limit" do
      expect(result).to be_failure
      expect(result.result).to eq :limit_exceeded

      expect(query_a.ordered_work_packages.reload.pluck(:position)).to all(eq 99)
      expect(query_b.ordered_work_packages.reload.pluck(:position)).to all(eq 99)
    end
  end

  describe "retrying on serialization failure/deadlock" do
    let(:query) { plain_query }
    let!(:widget) { add_column(query, column: 1) }
    let!(:work_package) { create(:work_package, project:) }

    subject(:service) { described_class.new(user:, board:, field:, direction:) }

    it "retries up to 3 times and eventually succeeds" do
      call_count = 0
      allow(service).to receive(:sleep)
      allow(service).to receive(:run_bounded_transaction) do |&block|
        call_count += 1
        raise ActiveRecord::SerializationFailure, "test" if call_count < 3

        block.call
      end

      expect(service.call).to be_success
      expect(call_count).to eq 3
    end

    it "gives up after exhausting retries, with zero writes from any attempt" do
      allow(service).to receive(:sleep)
      allow(service).to receive(:run_bounded_transaction).and_raise(ActiveRecord::Deadlocked, "test")

      result = service.call

      expect(result).to be_failure
      expect(result.result).to eq :retry_exhausted
      expect(query.ordered_work_packages.reload).to be_empty
    end
  end
end
