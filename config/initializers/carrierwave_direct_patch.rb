# frozen_string_literal: true

# Safety patch for carrierwave_direct 3.0.0 + Zeitwerk eager loading.
#
# Problem: CarrierWaveDirect::Mount#mount_uploader crashes with:
#   undefined method 'ancestors' for nil (NoMethodError)
# when the uploader argument is nil. This can happen if available_file_uploaders
# fails to load FogFileUploader for any reason and returns nil.
#
# The patch uses prepend so the nil guard runs BEFORE the original method,
# which still handles the direct-upload setup via super when uploader is present.
# This initializer runs before Zeitwerk's eager_load! initializer, so the patch
# is in place before any model calls mount_uploader.

if defined?(CarrierWaveDirect::Mount)
  CarrierWaveDirect::Mount.prepend(Module.new do
    def mount_uploader(column, uploader = nil, options = {}, &block)
      return unless uploader
      super
    end
  end)
end
