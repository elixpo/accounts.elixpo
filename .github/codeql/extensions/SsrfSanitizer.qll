/**
 * @name SSRF sanitizer for getSafeUrlForFetch
 * @description Marks getSafeUrlForFetch as a sanitizer for server-side request forgery.
 *   This function (src/lib/branding-validation.ts) validates protocol (https/http only),
 *   hostname format, blocks private IPv4 (10.x, 172.16-31.x, 192.168.x, 169.254.x, 127.x),
 *   loopback, and metadata addresses, then reconstructs the URL to prevent spoofing.
 */

import javascript
import semmle.javascript.security.dataflow.RequestForgeryCustomizations

class GetSafeUrlForFetchSanitizer extends RequestForgery::Sanitizer {
  GetSafeUrlForFetchSanitizer() {
    exists(DataFlow::CallNode call |
      call.getCalleeName() = "getSafeUrlForFetch" and
      this = call
    )
  }
}
