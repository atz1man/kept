require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name = 'KeptWidgetBridge'
  s.version = package['version']
  s.summary = package['description']
  s.license = package['license']
  s.homepage = 'https://github.com/atz1man/kept'
  s.author = package['author']
  s.source = { :git => 'https://github.com/atz1man/kept.git', :tag => package['version'] }
  s.source_files = 'ios/Sources/**/*.swift'
  s.ios.deployment_target = '13.0'
  # WidgetKit is iOS 14+; the app still runs on 13, where there is no widget to tell.
  s.weak_frameworks = 'WidgetKit'
  s.dependency 'Capacitor'
  s.swift_version = '5.1'
end
