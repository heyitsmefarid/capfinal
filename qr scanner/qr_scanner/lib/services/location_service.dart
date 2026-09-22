import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';

/// Best-effort GPS capture for "where was this attendance scan taken".
///
/// A scan must never be blocked or fail because location couldn't be
/// obtained (denied permission, disabled services, no fix in time, or an
/// unsupported platform) — every failure path here returns null instead of
/// throwing, so callers can simply omit location on the record.
class LocationService {
  // Native GPS hardware typically resolves well within 6s once permission
  // is granted. Web has no GPS chip — it has to show its own browser
  // permission prompt (separate from camera) and wait for a response, then
  // resolve via slower WiFi/IP-based positioning, which routinely blows
  // past 6s, especially on the very first request. A scan is never blocked
  // either way (see class doc above) — this only affects how long we keep
  // trying before giving up and omitting location.
  static const Duration _fixTimeout =
      kIsWeb ? Duration(seconds: 20) : Duration(seconds: 6);

  /// Attempts to get the current position. Returns null on any failure —
  /// callers should treat that exactly like "no location available", not
  /// an error.
  Future<Position?> getCurrentPosition() async {
    try {
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) return null;

      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        return null;
      }

      return await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.medium,
          timeLimit: _fixTimeout,
        ),
      ).timeout(_fixTimeout);
    } catch (e) {
      if (kDebugMode) {
        print('LocationService: could not get position: $e');
      }
      return null;
    }
  }
}
