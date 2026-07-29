import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import SettingsPanel from "./SettingsPanel";

describe("Search settings trigger", () => {
  it("renders an accessible icon-only button", () => {
    const html = renderToStaticMarkup(<SettingsPanel />);

    expect(html).toContain('aria-label="Open search settings"');
    expect(html).toContain('title="Open search settings"');
    expect(html).toContain("settings-panel__icon");
    expect(html).not.toContain("settings-panel__chevron");
    expect(html).not.toContain("&nbsp;Settings");
  });
});
