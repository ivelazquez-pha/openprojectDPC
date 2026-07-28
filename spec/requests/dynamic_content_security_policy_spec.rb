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

RSpec.describe "" do
  include CspHelper

  current_user { create(:user) }

  describe "GET /" do
    context "when collaborative_editing_hocuspocus_url is set as a valid URI" do
      it "responds with 200 and appends storage host to the connect-src CSP",
         with_settings: { collaborative_editing_hocuspocus_url: "wss://hocuspocus.local" } do
        get "/"

        expect(last_response).to have_http_status(200)
        csp = parse_csp(last_response.headers["Content-Security-Policy"])
        expect(csp["connect-src"]).to include("wss://hocuspocus.local")
      end
    end

    context "when collaborative_editing_hocuspocus_url is set to an invalid URI" do
      it "responds with 200 and logs the problem",
         with_settings: { collaborative_editing_hocuspocus_url: "://hocuspocus.local" } do
        allow(OpenProject.logger).to receive(:info)

        get "/"

        expect(last_response).to have_http_status(200)
        expect(OpenProject.logger).to have_received(:info) do |&blk|
          expect(blk.call).to eq "Setting.collaborative_editing_hocuspocus_url is set to an invalid URI: ://hocuspocus.local"
        end
      end
    end

    it "includes X-Content-Type-Options nosniff header to prevent content type sniffing" do
      get "/"

      expect(last_response).to have_http_status(200)
      expect(last_response.headers["X-Content-Type-Options"]).to eq "nosniff"
    end

    it "does not duplicate 'self' in font-src CSP directive" do
      get "/"

      csp = parse_csp(last_response.headers["Content-Security-Policy"])
      expect(csp["font-src"].count("'self'")).to eq(1)
    end

    it "includes 'self' in img-src CSP directive" do
      get "/"

      csp = parse_csp(last_response.headers["Content-Security-Policy"])
      expect(csp["img-src"]).to include("'self'")
    end

    it "does not duplicate 'self' in img-src CSP directive" do
      get "/"

      csp = parse_csp(last_response.headers["Content-Security-Policy"])
      expect(csp["img-src"].count("'self'")).to eq(1)
    end

    context "with remote storage hosts configured (e.g. Fog/OBS)" do
      it "includes the configured remote storage hosts in frame-src, so an iframe pointed " \
         "at a redirecting attachment content endpoint is not CSP-blocked" do
        # NOTE: the content_security_policy block is built once (cached by Rails on first
        # access) rather than re-evaluated per request, so stubbing OpenProject::Configuration
        # and issuing a live `get` will NOT pick up the stub. We invoke the stored policy
        # builder proc directly instead, which runs the real initializer code fresh.
        allow(OpenProject::Configuration).to receive(:remote_storage_hosts).and_return(["storage.example.com"])

        policy = ActionDispatch::ContentSecurityPolicy.new
        OpenProject::ContentSecurityPolicyConfig.apply(policy)

        csp = parse_csp(policy.build(nil, nil, []))
        expect(csp["frame-src"]).to include("storage.example.com")
      end
    end

    it "keeps 'self' in frame-src CSP directive when no remote storage host is configured" do
      # NOTE: same rationale as above - the content_security_policy block is built once, so
      # a request-time stub on a live `get` has no effect. We invoke the policy builder directly.
      allow(OpenProject::Configuration).to receive(:remote_storage_hosts).and_return([])

      policy = ActionDispatch::ContentSecurityPolicy.new
      OpenProject::ContentSecurityPolicyConfig.apply(policy)

      csp = parse_csp(policy.build(nil, nil, []))
      expect(csp["frame-src"]).to include("'self'")
    end
  end
end
