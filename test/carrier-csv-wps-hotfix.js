/* Staging hotfix: carrier quote CSV needs a comma-delimited file for WPS on macOS.
   Preserve CSV quoting, Unicode/BOM and the original field order. */
(() => {
  "use strict";
  if (!location.pathname.includes("/test/")) return;
  const nativeClick = HTMLAnchorElement.prototype.click;
  function convert(input) {
    let data = String(input).replace(/^\uFEFF/, "").replace(/^sep=[;,]\r?\n/i, "");
    const header = data.split(/\r?\n/, 1)[0];
    if (!header.includes(";")) return "\uFEFF" + data;
    let quoted = false, out = "";
    for (let i=0; i<data.length; i++) {
      const ch = data[i];
      if (ch === '"') {
        out += ch;
        if (quoted && data[i+1] === '"') {out += data[++i]; continue;}
        quoted = !quoted;
      } else {
        out += (ch === ";" && !quoted) ? "," : ch;
      }
    }
    return "\uFEFF" + out;
  }
  HTMLAnchorElement.prototype.click = function (...args) {
    if (!/^freight-form-fields(?:\s*\(\d+\))?\.csv$/i.test(this.download || "")) {
      return nativeClick.apply(this, args);
    }
    const link = this;
    const originalUrl = link.href;
    if (!originalUrl.startsWith("blob:")) return nativeClick.apply(link, args);
    fetch(originalUrl).then(r => r.text()).then(source => {
      const converted = convert(source);
      const url = URL.createObjectURL(new Blob([converted], {type:"text/csv;charset=utf-8"}));
      const copy = document.createElement("a");
      copy.href = url;
      copy.download = link.download;
      document.body.append(copy);
      nativeClick.call(copy);
      copy.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    }).catch(() => nativeClick.apply(link, args));
  };
})();
