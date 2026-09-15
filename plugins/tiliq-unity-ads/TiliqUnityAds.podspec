Pod::Spec.new do |s|
  s.name = 'TiliqUnityAds'
  s.version = '1.0.0'
  s.summary = 'Tiliq bridge for Unity Ads'
  s.license = { :type => 'UNLICENSED', :text => 'Proprietary. All rights reserved.' }
  s.author = 'Tiliq'
  s.homepage = 'https://github.com/gamcomp/tiliq-game'
  # CocoaPods reads the source files from Podfile's local :path dependency.
  s.source = { :git => 'https://github.com/gamcomp/tiliq-game.git', :branch => 'main' }
  s.source_files = 'ios/Sources/**/*.{swift,h,m}'
  s.ios.deployment_target = '15.0'
  s.swift_version = '5.1'
  s.static_framework = true
  s.dependency 'Capacitor'
  # 2026-09-16: 4.20.1 çıktı (bir önceki günde) — "çekiç" ödüllü reklamı siyah
  # ekranda donan/hiç render olmayan sorununa olası bir SDK yaması ihtimaline
  # karşı güncellendi.
  s.dependency 'UnityAds', '4.20.1'
end
