# Adds the iOS targets that live beside the app — the Home Screen widget for
# now — to ios/App/App.xcodeproj, and gives the app and each of them the one
# App Group they share. Idempotent: run again and nothing changes.
#
#   gem install xcodeproj && ruby scripts/ios-targets.rb
#
# Written as a script rather than done by hand in Xcode because there is no Mac
# where this repository is worked on most, and a project file edited in a text
# editor is how a target ends up half added. test/widget.test.ts reads the
# result.
require 'xcodeproj'

ROOT = File.expand_path('..', __dir__)
project = Xcodeproj::Project.open(File.join(ROOT, 'ios/App/App.xcodeproj'))
app = project.targets.find { |t| t.name == 'App' } or abort('no App target')
bundle_id = app.build_configurations.first.build_settings['PRODUCT_BUNDLE_IDENTIFIER']

# The App Group, declared once at the project level and read by every target's
# entitlements and Info.plist as $(KEPT_APP_GROUP). scripts/set-bundle-id.mjs
# rewrites it with the bundle identifier.
project.build_configurations.each do |config|
  config.build_settings['KEPT_APP_GROUP'] = "group.#{bundle_id}"
end
app.build_configurations.each do |config|
  config.build_settings['CODE_SIGN_ENTITLEMENTS'] = 'App/App.entitlements'
end
app_group = project.main_group.find_subpath('App', false)
app_group.new_reference('App.entitlements') unless app_group.files.any? { |f| f.path == 'App.entitlements' }

NAME = 'QuidsInWidget'
unless project.targets.any? { |t| t.name == NAME }
  widget = project.new_target(:app_extension, NAME, :ios, '16.0')
  group = project.main_group.new_group(NAME, NAME)
  source = group.new_reference('QuidsInWidget.swift')
  group.new_reference('Info.plist')
  group.new_reference('QuidsInWidget.entitlements')
  manifest = group.new_reference('PrivacyInfo.xcprivacy')
  widget.add_file_references([source])
  widget.add_resources([manifest])
  widget.add_system_framework(%w[WidgetKit SwiftUI])
  widget.build_configurations.each do |config|
    s = config.build_settings
    s['PRODUCT_BUNDLE_IDENTIFIER'] = "#{bundle_id}.widget"
    s['PRODUCT_NAME'] = '$(TARGET_NAME)'
    s['INFOPLIST_FILE'] = "#{NAME}/Info.plist"
    s['CODE_SIGN_ENTITLEMENTS'] = "#{NAME}/QuidsInWidget.entitlements"
    s['SWIFT_VERSION'] = '5.0'
    s['TARGETED_DEVICE_FAMILY'] = '1' # iPhone only, as the app is (test/ios-device-family.test.ts)
    s['IPHONEOS_DEPLOYMENT_TARGET'] = '16.0'
    s['SKIP_INSTALL'] = 'YES'
    s['CODE_SIGN_STYLE'] = 'Automatic'
    s['MARKETING_VERSION'] = app.build_configurations.first.build_settings['MARKETING_VERSION'] || '1.0'
    s['CURRENT_PROJECT_VERSION'] = app.build_configurations.first.build_settings['CURRENT_PROJECT_VERSION'] || '1'
    s['DEVELOPMENT_TEAM'] = app.build_configurations.first.build_settings['DEVELOPMENT_TEAM']
    s['LD_RUNPATH_SEARCH_PATHS'] = '$(inherited) @executable_path/Frameworks @executable_path/../../Frameworks'
  end
  # The app carries the widget: built first, then copied into PlugIns.
  app.add_dependency(widget)
  embed = app.new_copy_files_build_phase('Embed App Extensions')
  embed.dst_subfolder_spec = Xcodeproj::Constants::COPY_FILES_BUILD_PHASE_DESTINATIONS[:plug_ins]
  build_file = embed.add_file_reference(widget.product_reference, true)
  build_file.settings = { 'ATTRIBUTES' => ['RemoveHeadersOnCopy'] }
end

project.save
puts "App Group group.#{bundle_id}; targets: #{project.targets.map(&:name).join(', ')}"
