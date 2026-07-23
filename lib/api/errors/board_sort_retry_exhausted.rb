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
    # Raised by the bounded board "Sort by..." command when the whole
    # transaction still hits a serialization failure/deadlock after all
    # retries (see design "Bounded Sort Data Flow" step 6). No writes from any
    # attempt are committed.
    class BoardSortRetryExhausted < ErrorBase
      identifier "BoardSortRetryExhausted"
      code 409

      def initialize
        super(I18n.t("api_v3.errors.conflict.board_sort_retry_exhausted"))
      end
    end
  end
end
