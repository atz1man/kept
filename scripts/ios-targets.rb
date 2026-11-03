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

# Each extension the app carries: its folder (also the target's name), the
# suffix on the app's bundle identifier, its Swift sources, and the system
# frameworks it links.
EXTENSIONS = [
  { name: 'QuidsInWidget', suffix: 'widget', sources: ['QuidsInWidget.swift'], frameworks: %w[WidgetKit SwiftUI] },
  { name: 'QuidsInShare', suffix: 'share', sources: ['ShareViewController.swift'], frameworks: %w[UniformTypeIdentifiers] },
]

embed = app.copy_files_build_phases.find { |p| p.name == 'Embed App Extensions' }
EXTENSIONS.each do |ext|
  next if project.targets.any? { |t| t.name == ext[:name] }
  target = project.new_target(:app_extension, ext[:name], :ios, '16.0')
  group = project.main_group.new_group(ext[:name], ext[:name])
  sources = ext[:sources].map { |f| group.new_reference(f) }
  group.new_reference('Info.plist')
  group.new_reference("#{ext[:name]}.entitlements")
  manifest = group.new_reference('PrivacyInfo.xcprivacy')
  target.add_file_references(sources)
  target.add_resources([manifest])
  target.add_system_framework(ext[:frameworks])
  target.build_configurations.each do |config|
    s = config.build_settings
    s['PRODUCT_BUNDLE_IDENTIFIER'] = "#{bundle_id}.#{ext[:suffix]}"
    s['PRODUCT_NAME'] = '$(TARGET_NAME)'
    s['INFOPLIST_FILE'] = "#{ext[:name]}/Info.plist"
    s['CODE_SIGN_ENTITLEMENTS'] = "#{ext[:name]}/#{ext[:name]}.entitlements"
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
  # The app carries the extension: built first, then copied into PlugIns.
  app.add_dependency(target)
  unless embed
    embed = app.new_copy_files_build_phase('Embed App Extensions')
    embed.dst_subfolder_spec = Xcodeproj::Constants::COPY_FILES_BUILD_PHASE_DESTINATIONS[:plug_ins]
  end
  build_file = embed.add_file_reference(target.product_reference, true)
  build_file.settings = { 'ATTRIBUTES' => ['RemoveHeadersOnCopy'] }
end

project.save
puts "App Group group.#{bundle_id}; targets: #{project.targets.map(&:name).join(', ')}"
