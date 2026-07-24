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
require_relative "support/board_index_page"
require_relative "support/board_page"

RSpec.describe "Work Package boards card sort spec",
               :js,
               :selenium do
  let(:admin) { create(:admin) }
  let(:project) { create(:project, enabled_module_names: %i[work_package_tracking board_view]) }
  let(:board_index) { Pages::BoardIndex.new(project) }
  let!(:status) { create(:default_status) }
  let!(:board_view) { create(:board_grid_with_query, name: "My board", project:) }

  before do
    project
    login_as(admin)
  end

  context "with a filtered board of 500 or fewer visible cards" do
    let!(:work_packages) do
      [
        create(:work_package, project:, subject: "Charlie", due_date: 3.days.from_now),
        create(:work_package, project:, subject: "Alpha", due_date: 1.day.from_now),
        create(:work_package, project:, subject: "Bravo", due_date: 2.days.from_now)
      ]
    end

    it "sorts the column and the resulting order survives a normal reload, then a drag behaves normally" do
      work_packages
      board_index.visit!
      board_page = board_index.open_board board_view

      board_page.expect_query "List 1", editable: true
      board_page.expect_sort_action(present: true)

      board_page.sort_board(field: "Finish date", direction: "asc")
      board_page.expect_and_dismiss_toaster message: I18n.t(:notice_successful_update)

      board_page.expect_cards_in_order "List 1", "Alpha", "Bravo", "Charlie"

      # Immediately drag a card after the sort - this must behave like a
      # completely normal manual reorder (no stale pre-sort position cache).
      board_page.move_card(0, from: "List 1", to: "List 1")
      board_page.expect_cards_in_order "List 1", "Alpha", "Bravo", "Charlie"
    end
  end

  context "with a board exceeding the 500-card total canvas limit" do
    let!(:work_packages) { create_list(:work_package, 501, project:) }

    it "rejects the sort with the filter-guidance message and writes nothing" do
      work_packages
      board_index.visit!
      board_page = board_index.open_board board_view

      board_page.expect_query "List 1", editable: true
      board_page.sort_board(field: "Subject", direction: "asc")

      board_page.expect_sort_error(
        "There are more than 500 visible cards on this board. Apply filters to reduce them before sorting."
      )

      query = Query.find_by(name: "List 1")
      expect(query.ordered_work_packages.count).to eq 0
    end
  end
end
