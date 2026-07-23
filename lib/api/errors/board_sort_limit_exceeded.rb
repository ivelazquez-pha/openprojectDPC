# frozen_string_literal: true

#-- copyright
# OpenProject is an open source project management software.
# Copyright (C) the OpenProject GmbH
#
# This program is free software; you can redistribute it and/or
# modify it under the terms of the GNU General Public License version 3.
#++

module API
  module Errors
    ##
    # Raised by the bounded board "Sort by..." command when the effective
    # filtered canvas (across every column) totals 501 or more visible card
    # occurrences. Exactly 500 is valid. Zero positions are written before
    # this error is raised - see design "Bounded Sort Data Flow" step 4.
    class BoardSortLimitExceeded < ErrorBase
      identifier "BoardSortLimitExceeded"
      code 422

      def initialize
        super(I18n.t("api_v3.errors.unprocessable.board_sort_limit_exceeded"))
      end
    end
  end
end
