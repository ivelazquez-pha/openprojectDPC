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
require "rack/test"

# Covers the opt-in `?disposition=attachment` force-download override on the
# attachment content endpoint (GET /api/v3/attachments/:id/content), for both
# local storage and external (Fog/OBS) storage.
RSpec.describe "attachment content disposition override", content_type: :json, type: :request do
  include Rack::Test::Methods
  include API::V3::Utilities::PathHelper
  include FileHelpers

  let(:current_user) { create(:user) }
  let(:path) { api_v3_paths.attachment_content(attachment.id) }
  let(:mock_file) { mock_uploaded_file(name: "test.pdf", content_type: "application/pdf") }

  subject(:response) { last_response }

  before do
    allow(User).to receive(:current).and_return current_user
  end

  context "with local storage" do
    let(:attachment) do
      att = create(:attachment, container: nil, author: current_user, file: mock_file)
      att.file.store!
      # Bypass real content-type detection (mock file content is not a real PDF)
      # so the attachment is treated as an inlineable PDF, mirroring the pattern
      # used in attachment_resource_shared_examples.rb.
      att.send(:write_attribute, :file, mock_file.original_filename)
      att.send(:write_attribute, :content_type, mock_file.content_type)
      att.save!
      att
    end

    context "without the disposition param" do
      before { get path }

      it "keeps the default (inline) disposition for a PDF, unchanged" do
        expect(response.headers["Content-Disposition"])
          .to eq "inline; filename=#{attachment.filename}"
      end
    end

    context "with disposition=attachment" do
      before { get path, disposition: "attachment" }

      it "forces the attachment disposition" do
        expect(response.headers["Content-Disposition"])
          .to eq "attachment; filename=#{attachment.filename}"
      end
    end

    context "with disposition=inline" do
      before { get path, disposition: "inline" }

      it "responds 400 and does not reach the model layer" do
        expect(response.status).to eq 400
      end
    end

    context "with an arbitrary, non-allowlisted disposition value" do
      before { get path, disposition: "evil" }

      it "responds 400" do
        expect(response.status).to eq 400
      end
    end
  end

  # NOTE: the redirect-with-forced-disposition behavior for external (fog/OBS)
  # storage cannot be exercised at this HTTP/request layer: `FogAttachment` (see
  # with_direct_uploads.rb) is a plain Ruby subclass used only to mount
  # FogFileUploader on an in-memory instance. It is not real Rails STI (no
  # `type` column), so `Attachment.find(params[:id])` in the controller
  # re-instantiates the record as a plain `Attachment` and loses the Fog
  # uploader mount, making `external_storage?` false and causing a 404 instead
  # of a redirect - a pre-existing limitation of this test harness, already
  # acknowledged in with_direct_uploads.rb's own comments for the direct-upload
  # callback. That behavior is covered where it CAN be exercised correctly, at
  # the model level, in spec/models/attachment_spec.rb ("#external_url" /
  # "#content_disposition with force:").
  context "with an arbitrary, non-allowlisted disposition value on external storage",
          :with_direct_uploads do
    let(:attachment) do
      att = FogAttachment.new(author: current_user, file: mock_file)
      att.save!
      att.send(:write_attribute, :content_type, mock_file.content_type)
      att.save!
      att
    end

    before { get path, disposition: "evil" }

    it "responds 400 and never reaches the model/redirect layer" do
      expect(response.status).to eq 400
    end
  end
end
