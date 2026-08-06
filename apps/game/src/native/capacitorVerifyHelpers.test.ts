import { describe, expect, it } from "vitest";
import {
  containsAuthoritativeMarker,
  containsLiveReloadAddress,
  containsShaReference,
  extractBundleIdentifiers,
  extractConfigField,
  extractOrientationList,
  hasServerUrlBlock,
} from "../../scripts/lib/capacitorVerifyHelpers.mjs";

describe("extractConfigField", () => {
  it("extracts a double-quoted field value", () => {
    const source = `const config = { appId: "com.rockyjojo1.everloom", appName: "Everloom" };`;
    expect(extractConfigField(source, "appId")).toBe("com.rockyjojo1.everloom");
    expect(extractConfigField(source, "appName")).toBe("Everloom");
  });

  it("extracts a single-quoted field value", () => {
    const source = `{ webDir: 'dist' }`;
    expect(extractConfigField(source, "webDir")).toBe("dist");
  });

  it("returns null when the field is absent", () => {
    expect(extractConfigField(`{ appId: "x" }`, "webDir")).toBe(null);
  });
});

describe("hasServerUrlBlock", () => {
  it("detects a server.url block", () => {
    const source = `const config = { server: { url: "http://192.168.1.5:8100", cleartext: true } };`;
    expect(hasServerUrlBlock(source)).toBe(true);
  });

  it("returns false when there is no server block", () => {
    const source = `const config = { appId: "com.rockyjojo1.everloom", webDir: "dist" };`;
    expect(hasServerUrlBlock(source)).toBe(false);
  });

  it("returns false when server exists but has no url field", () => {
    const source = `const config = { server: { androidScheme: "https" } };`;
    expect(hasServerUrlBlock(source)).toBe(false);
  });
});

describe("containsLiveReloadAddress", () => {
  it("flags localhost", () => {
    expect(containsLiveReloadAddress("http://localhost:8100")).toBe(true);
  });

  it("flags 127.0.0.1", () => {
    expect(containsLiveReloadAddress("http://127.0.0.1:8100")).toBe(true);
  });

  it("flags ws://", () => {
    expect(containsLiveReloadAddress("ws://example-livereload-host/")).toBe(true);
  });

  it("flags private-LAN 192.168.x.x", () => {
    expect(containsLiveReloadAddress("http://192.168.1.42:8100")).toBe(true);
  });

  it("flags private-LAN 10.x.x.x", () => {
    expect(containsLiveReloadAddress("http://10.0.0.5:8100")).toBe(true);
  });

  it("flags private-LAN 172.16-31.x.x", () => {
    expect(containsLiveReloadAddress("http://172.20.0.5:8100")).toBe(true);
  });

  it("does not flag a public-looking bundled asset reference", () => {
    expect(containsLiveReloadAddress(`{ appId: "com.rockyjojo1.everloom", webDir: "dist" }`)).toBe(false);
  });
});

describe("extractBundleIdentifiers", () => {
  it("extracts and deduplicates PRODUCT_BUNDLE_IDENTIFIER values", () => {
    const pbxproj = `
      PRODUCT_BUNDLE_IDENTIFIER = com.rockyjojo1.everloom;
      PRODUCT_BUNDLE_IDENTIFIER = com.rockyjojo1.everloom;
    `;
    expect(extractBundleIdentifiers(pbxproj)).toEqual(["com.rockyjojo1.everloom"]);
  });

  it("returns an empty array when absent", () => {
    expect(extractBundleIdentifiers("no identifiers here")).toEqual([]);
  });

  it("preserves distinct values instead of collapsing them", () => {
    const pbxproj = `
      PRODUCT_BUNDLE_IDENTIFIER = com.rockyjojo1.everloom;
      PRODUCT_BUNDLE_IDENTIFIER = com.rockyjojo1.everloom.wrong;
    `;
    expect(extractBundleIdentifiers(pbxproj)).toEqual([
      "com.rockyjojo1.everloom",
      "com.rockyjojo1.everloom.wrong",
    ]);
  });
});

describe("extractOrientationList", () => {
  const plist = `<?xml version="1.0"?>
<plist>
<dict>
  <key>UISupportedInterfaceOrientations</key>
  <array>
    <string>UIInterfaceOrientationLandscapeLeft</string>
    <string>UIInterfaceOrientationLandscapeRight</string>
  </array>
  <key>UISupportedInterfaceOrientations~ipad</key>
  <array>
    <string>UIInterfaceOrientationLandscapeLeft</string>
    <string>UIInterfaceOrientationLandscapeRight</string>
  </array>
</dict>
</plist>`;

  it("extracts the iPhone orientation array", () => {
    expect(extractOrientationList(plist, "UISupportedInterfaceOrientations")).toEqual([
      "UIInterfaceOrientationLandscapeLeft",
      "UIInterfaceOrientationLandscapeRight",
    ]);
  });

  it("extracts the iPad-specific key without colliding with the iPhone key", () => {
    expect(extractOrientationList(plist, "UISupportedInterfaceOrientations~ipad")).toEqual([
      "UIInterfaceOrientationLandscapeLeft",
      "UIInterfaceOrientationLandscapeRight",
    ]);
  });

  it("returns an empty array for a missing key", () => {
    expect(extractOrientationList(plist, "NoSuchKey")).toEqual([]);
  });
});

describe("containsShaReference", () => {
  it("detects an exact SHA substring", () => {
    expect(containsShaReference("evidence at 40fa44878bfb7105ed5d15f4ad406898a4b799e6", "40fa44878bfb7105ed5d15f4ad406898a4b799e6")).toBe(true);
  });

  it("returns false when absent", () => {
    expect(containsShaReference("evidence at 64359ce4d146804e28e30b5e5919bba63af9a0c2", "40fa44878bfb7105ed5d15f4ad406898a4b799e6")).toBe(false);
  });
});

describe("containsAuthoritativeMarker", () => {
  it("detects the Gate 4 authoritative-app marker", () => {
    expect(containsAuthoritativeMarker(`data-everloom-authoritative-app="apps-game"`)).toBe(true);
  });

  it("returns false when absent", () => {
    expect(containsAuthoritativeMarker("some unrelated bundle content")).toBe(false);
  });
});
