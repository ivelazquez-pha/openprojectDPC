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
#

require "spec_helper"

module WorkPackageTypes
  RSpec.describe BoardCardConfigurationTabController do
    let(:user) { create(:admin) }
    let(:wp_type) { create(:type) }

    current_user { user }

    before do
      # Clear up the request store cache for all_work_package_attributes
      RequestStore.clear!
    end

    context "when the user is not logged in" do
      let(:user) { User.anonymous }

      it "requires login" do
        get :edit, params: { type_id: wp_type.id }
        expect(response.status).to redirect_to signin_url(back_url: edit_type_board_card_configuration_url(wp_type))
      end
    end

    context "when the user is not an admin" do
      let(:user) { create(:user) }

      it "responds with forbidden on GET #edit" do
        get :edit, params: { type_id: wp_type.id }
        expect(response).to have_http_status :forbidden
      end

      it "responds with forbidden on PUT #update" do
        put :update, params: { type_id: wp_type.id }
        expect(response).to have_http_status :forbidden
      end
    end

    describe "GET #edit" do
      it "responds with success" do
        get :edit, params: { type_id: wp_type.id }
        expect(response).to have_http_status :ok
      end
    end

    describe "PUT #update" do
      before do
        put :update, params: {
          type_id: wp_type.id,
          work_package_types_forms_board_card_configuration_form_model: { board_card_field_ids: field_configs }
        }
      end

      context "with valid field configurations" do
        let(:field_configs) do
          [
            { field_id: "priority" },
            { field_id: "assignee", zone: "footer", show_label: "0" }
          ]
        end

        it "redirects to the current tab path" do
          expect(response).to redirect_to edit_type_board_card_configuration_path(type_id: wp_type.id)
        end

        it "persists the ordered field configurations, casting the HTML form's string values" do
          wp_type.reload

          expect(wp_type.board_card_fields.field_ids).to eq(%w[priority assignee])

          footer_field = wp_type.board_card_fields.field_configs.last
          expect(footer_field.zone).to eq("footer")
          expect(footer_field.show_label).to be false
        end
      end

      context "with a row that has no field selected (the always-present blank row)" do
        let(:field_configs) { [{ field_id: "" }] }

        it "persists an empty configuration" do
          expect(wp_type.reload.board_card_field_ids).to eq([])
        end
      end

      context "with an unknown field identifier" do
        let(:field_configs) { [{ field_id: "priority" }, { field_id: "not_a_real_attribute" }] }

        it "renders the edit template with an unprocessable status" do
          expect(response).to have_http_status :unprocessable_entity
          expect(response).to render_template "work_package_types/board_card_configuration_tab/edit"
        end

        it "does not persist the invalid configuration" do
          expect(wp_type.reload.board_card_field_ids).to be_nil
        end
      end

      context "with the same field configured twice" do
        let(:field_configs) { [{ field_id: "priority" }, { field_id: "priority", zone: "footer" }] }

        it "renders the edit template with an unprocessable status" do
          expect(response).to have_http_status :unprocessable_entity
        end
      end

      context "with an unknown color id" do
        let(:field_configs) { [{ field_id: "priority", color_id: "999999" }] }

        it "renders the edit template with an unprocessable status" do
          expect(response).to have_http_status :unprocessable_entity
        end
      end
    end
  end
end
