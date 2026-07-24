# frozen_string_literal: true

#-- copyright
# OpenProject is an open source project management software.
# Copyright (C) the OpenProject GmbH
#
# This program is free software; you can redistribute it and/or
# modify it under the terms of the GNU General Public License version 3.
#++

module API
  module V3
    module Boards
      ##
      # Mounted inside API::V3::Grids::GridsAPI's route_param(:id) block (see
      # OpenProject::Boards::Engine), so this yields
      # POST /api/v3/grids/:id/board_order.
      class BoardOrderAPI < ::API::OpenProjectAPI
        resource :board_order do
          params do
            requires :field, type: String, desc: "The attribute to sort every column by"
            requires :direction, type: String, values: %w[asc desc], desc: "Sort direction"
          end
          post do
            board = ::OpenProject::Boards::GridRegistration
              .visible(current_user)
              .find_by(id: params[:id])

            raise ::API::Errors::NotFound unless board

            result = ::Boards::BoardOrderService.call(
              user: current_user,
              board:,
              field: params[:field],
              direction: params[:direction]
            )

            if result.success?
              status 204
            else
              case result.result
              when :unauthorized
                raise ::API::Errors::NotFound
              when :invalid_field
                raise ::API::Errors::UnprocessableContent,
                      "The field '#{params[:field]}' is not sortable across every column of this board."
              when :limit_exceeded
                raise ::API::Errors::BoardSortLimitExceeded
              when :retry_exhausted
                raise ::API::Errors::BoardSortRetryExhausted
              else
                raise ::API::Errors::UnprocessableContent, "Unexpected board sort failure."
              end
            end
          end
        end
      end
    end
  end
end
