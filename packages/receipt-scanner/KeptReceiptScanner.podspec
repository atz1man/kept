require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name = 'KeptReceiptScanner'
  s.version = package['version']
  s.summary = package['description']
  s.license = package['license']
  s.homepage = 'https://github.com/atz1man/kept'
  s.author = package['author']
  s.source = { :git => 'https://github.com/atz1man/kept.git', :tag => package['version'] }
  s.source_files = 'ios/Sources/**/*.swift'
  s.ios.deployment_target = '13.0'
  s.frameworks = 'VisionKit', 'Vision'
  s.dependency 'Capacitor'
  s.swift_version = '5.1'
end
