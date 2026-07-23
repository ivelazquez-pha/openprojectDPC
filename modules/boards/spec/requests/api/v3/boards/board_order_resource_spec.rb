# frozen_string_literal: true

#-- copyright
# OpenProject is an open source project management software.
# Copyright (C) the OpenProject GmbH
#
# This program is free software; you can redistribute it and/or
# modify it under the terms of the GNU General Public License version 3.
#++

require "spec_helper"
require "rack/test"

RSpec.describe "POST /api/v3/grids/:id/board_order" do
  let(:project) { create(:project) }
  let(:user) do
    create(:user,
           member_with_permissions: { project => %i[show_board_views view_work_packages edit_work_packages] })
  end
  let(:board) { create(:board_grid, project:) }
  let(:query) { create(:public_query, project:) }
  let!(:widget) do
    create(:grid_widget,
           grid: board,
           identifier: "work_package_query",
           start_row: 1,
           end_row: 2,
           start_column: 1,
           end_column: 1,
           options: { "queryId" => query.id })
  end
  let!(:work_package) { create(:work_package, project:) }

  let(:path) { "/api/v3/grids/#{board.id}/board_order" }
  let(:body) { { field: "due_date", direction: "asc" } }

  subject(:response_json) { JSON.parse(last_response.body) }

  before do
    login_as user
    header "Content-Type", "application/json"
  end

  it "sorts the board and responds 204 with no content" do
    post path, body.to_json

    expect(last_response).to have_http_status :no_content
    expect(query.ordered_work_packages.reload.count).to eq 1
  end

  context "when the board does not exist" do
    let(:path) { "/api/v3/grids/0/board_order" }

    it "responds 404 Not Found" do
      post path, body.to_json

      expect(last_response).to have_http_status :not_found
    end
  end

  context "when the user has neither show_board_views nor manage_board_views" do
    let(:user) { create(:user, member_with_permissions: { project => [:view_work_packages] }) }

    it "responds 404 Not Found (identical to a missing board - no existence leak)" do
      post path, body.to_json

      expect(last_response).to have_http_status :not_found
    end
  end

  context "when the board is not visible to an anonymous/unrelated user" do
    let(:other_project) { create(:project) }
    let(:user) { create(:user, member_with_permissions: { other_project => [:show_board_views] }) }

    it "responds 404 Not Found" do
      post path, body.to_json

      expect(last_response).to have_http_status :not_found
    end
  end

  context "when the service reports the field is not sortable across every column" do
    before do
      allow(Boards::BoardOrderService).to receive(:call)
        .and_return(ServiceResult.failure(result: :invalid_field))
    end

    it "responds 422 Unprocessable Content" do
      post path, body.to_json

      expect(last_response).to have_http_status :unprocessable_entity
    end
  end

  context "when the service reports the 500-card limit was exceeded" do
    before do
      allow(Boards::BoardOrderService).to receive(:call)
        .and_return(ServiceResult.failure(result: :limit_exceeded))
    end

    it "responds 422 with the filter-guidance message and identifier" do
      post path, body.to_json

      expect(last_response).to have_http_status :unprocessable_entity
      expect(response_json["errorIdentifier"]).to eq "urn:openproject-org:api:v3:errors:BoardSortLimitExceeded"
      expect(response_json["message"]).to eq(
        "There are more than 500 visible cards on this board. Apply filters to reduce them before sorting."
      )
    end
  end

  context "when the service exhausts its serialization/deadlock retries" do
    before do
      allow(Boards::BoardOrderService).to receive(:call)
        .and_return(ServiceResult.failure(result: :retry_exhausted))
    end

    it "responds 409 Conflict" do
      post path, body.to_json

      expect(last_response).to have_http_status :conflict
      expect(response_json["errorIdentifier"]).to eq "urn:openproject-org:api:v3:errors:BoardSortRetryExhausted"
    end
  end

  context "when the service reports the board/query became unauthorized inside the transaction" do
    before do
      allow(Boards::BoardOrderService).to receive(:call)
        .and_return(ServiceResult.failure(result: :unauthorized))
    end

    it "responds 404 Not Found (same contract as a missing/invisible board)" do
      post path, body.to_json

      expect(last_response).to have_http_status :not_found
    end
  end

  describe "parameter validation" do
    it "requires field and direction" do
      post path, {}.to_json

      expect(last_response).to have_http_status :bad_request
    end

    it "rejects an invalid direction value" do
      post path, { field: "due_date", direction: "sideways" }.to_json

      expect(last_response).to have_http_status :bad_request
    end
  end
end
