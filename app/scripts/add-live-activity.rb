# Adds the "LiveActivity" widget extension (ios/LiveActivity) to the Xcode project and embeds it in the app.
# Runs on the Mac build machine before building (needs the xcodeproj gem, which ships with CocoaPods). Safe to run twice.
require 'xcodeproj'
root = File.expand_path('..', __dir__)
proj = Xcodeproj::Project.open(File.join(root, 'ios/App/App.xcodeproj'))
exit 0 if proj.targets.any? { |t| t.name == 'LiveActivity' }
app = proj.targets.find { |t| t.name == 'App' }
ext = proj.new_target(:app_extension, 'LiveActivity', :ios, '16.2')
group = proj.main_group.new_group('LiveActivity', '../LiveActivity')
%w[WFDLiveActivity.swift GenericAttributes.swift].each { |f| ext.add_file_references([group.new_file(f)]) }
group.new_file('Info.plist')
%w[SwiftUI WidgetKit ActivityKit].each do |fw|
  ref = proj.frameworks_group.new_file("System/Library/Frameworks/#{fw}.framework", :sdk_root)
  ext.frameworks_build_phase.add_file_reference(ref, true)
end
team = app.build_configurations.first.build_settings['DEVELOPMENT_TEAM']
ext.build_configurations.each do |c|
  s = c.build_settings
  s['PRODUCT_BUNDLE_IDENTIFIER'] = 'com.jscottii.wfd.LiveActivity'
  s['PRODUCT_NAME'] = '$(TARGET_NAME)'
  s['INFOPLIST_FILE'] = '../LiveActivity/Info.plist'
  s['GENERATE_INFOPLIST_FILE'] = 'YES'
  s['INFOPLIST_KEY_CFBundleDisplayName'] = 'WFD Cook Day'
  s['SWIFT_VERSION'] = '5.0'
  s['TARGETED_DEVICE_FAMILY'] = '1,2'
  s['IPHONEOS_DEPLOYMENT_TARGET'] = '16.2'
  s['SKIP_INSTALL'] = 'YES'
  s['CODE_SIGN_STYLE'] = 'Automatic'
  s['DEVELOPMENT_TEAM'] = team if team
  s['LD_RUNPATH_SEARCH_PATHS'] = ['$(inherited)', '@executable_path/Frameworks', '@executable_path/../../Frameworks']
  s['ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME'] = 'AccentColor'
end
embed = app.new_copy_files_build_phase('Embed Foundation Extensions')
embed.symbol_dst_subfolder_spec = :plug_ins
bf = embed.add_file_reference(ext.product_reference, true)
bf.settings = { 'ATTRIBUTES' => ['RemoveHeadersOnCopy'] }
app.add_dependency(ext)
proj.save
puts 'Added LiveActivity widget extension'
