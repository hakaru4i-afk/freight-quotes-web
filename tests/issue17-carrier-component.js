function Ky({ item: i, role: c, claims: h, onChanged: m }) {
  bd();
  let [d, g] = ee.useState(null),
    [u, y] = ee.useState(""),
    [_, w] = ee.useState(""),
    [b, A] = ee.useState(!1),
    [D, R] = ee.useState(!1),
    [L, M] = ee.useState({}),
    [N, E] = ee.useState(""),
    [S, T] = ee.useState("USD"),
    [F, W] = ee.useState(""),
    [V, I] = ee.useState("");
  async function $({ preserveDraft: f = !1 } = {}) {
    let P = await Ze("/api/transport-applications?" + _f(i));
    return (
      g(P),
      !f && M(P.documentModel?.values || { ...P.defaults, ...P.item.booking?.details }),
      !f &&
        E(c === "carrier" ? P.documentModel?.amount ?? P.item.selected_offer?.bid?.amount ?? "" : P.item.booking?.amount ?? P.item.selected_offer?.bid?.amount ?? ""),
      !f &&
        T(
          (c === "carrier" ? P.documentModel?.currency : P.item.booking?.currency) ||
            P.item.selected_offer?.bid?.currency ||
            "USD",
        ),
      !f && W(P.item.route_key || ""),
      P
    );
  }
  ee.useEffect(() => {
    let f = !0;
    return (
      $().catch((P) => f && y(P.message)),
      () => {
        f = !1;
      }
    );
  }, [i.award_id]);
  async function X(f, P) {
    (A(!0), y(""), w(""));
    try {
      (await Ze(f, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: i.source_kind,
          id: i.source_id,
          award: i.award_id,
          revision: f.includes("execution")
            ? d.execution.revision
            : d.item.booking?.revision || 0,
          ...P,
        }),
      }),
        await $({ preserveDraft: f.includes("execution") || P.action === "correction_request" }),
        R(!1),
        I(""),
        w("\u0421\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u043E"),
        m?.());
    } catch (q) {
      y(q.message);
    } finally {
      A(!1);
    }
  }
  if (!d)
    return r("div", {
      children: u
        ? r("p", { role: "alert", children: u })
        : "\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043C \u0437\u0430\u044F\u0432\u043A\u0443\u2026",
    });
  let { item: K, execution: de, docs: G, claim: ce } = d,
    he = K.booking,
    ne = c === "carrier",
    j = ["owner", "logistic"].includes(c),
    B =
      (ne &&
        ["in_progress", "pending", "rejected", "approved"].includes(
          he?.state,
        )) ||
      (j && D),
    x = Ue("applications.fill"),
    re = K.archived || (K.read_only && de.stage !== "completed");
  function H(f, P) {
    M((q) => {
      let le = { ...q, [f]: P };
      if (
        (["origin", "destination", "waypoints", "transport"].includes(f) &&
          W(""),
        f === "ready_date")
      ) {
        let ue = Xm(K.selected_offer?.bid, P);
        ue.date && (le.etd = ue.date);
      }
      return le;
    });
  }
  let C = (f) => {
    let P =
        f.type === "incoterm"
          ? [
              "EXW",
              "FCA",
              "CPT",
              "CIP",
              "DAP",
              "DPU",
              "DDP",
              "FAS",
              "FOB",
              "CFR",
              "CIF",
            ]
          : f.type === "transport"
            ? [
                "\u0410\u0432\u0442\u043E",
                "\u0416\u0414",
                "\u041C\u043E\u0440\u0435",
                "\u0410\u0432\u0438\u0430",
                "\u041C\u0443\u043B\u044C\u0442\u0438\u043C\u043E\u0434\u0430\u043B\u044C\u043D\u0430\u044F",
              ]
            : f.type === "currency"
              ? ["USD", "EUR", "CNY", "BYN", "RUB"]
              : f.type === "danger"
                ? ["unknown", "no", "yes"]
                : f.type === "yesno"
                  ? ["no", "yes"]
                  : null,
      q = f.key === "etd" && !!Xm(K.selected_offer?.bid, L.ready_date).date;
    return o(
      "label",
      {
        className: "field" + (f.type === "textarea" ? " full" : ""),
        children: [
          r("span", { children: f.ru + (f.required ? " *" : "") }),
          r("small", { lang: "en", translate: "no", children: f.en }),
          P
            ? r("select", {
                value: L[f.key] ?? "",
                onChange: (le) => H(f.key, le.target.value),
                children: [
                  r("option", {
                    value: "",
                    children:
                      "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435",
                  }),
                  ...P.map((le) =>
                    r(
                      "option",
                      {
                        value: le,
                        children:
                          {
                            yes: "\u0414\u0430",
                            no: "\u041D\u0435\u0442",
                            unknown:
                              "\u041D\u0435 \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u043E",
                          }[le] || le,
                      },
                      le,
                    ),
                  ),
                ],
              })
            : f.type === "textarea"
              ? r("textarea", {
                  value: L[f.key] ?? "",
                  maxLength: 4e3,
                  onChange: (le) => H(f.key, le.target.value),
                })
              : r("input", {
                  type:
                    f.type === "date"
                      ? "date"
                      : f.type === "number"
                        ? "number"
                        : "text",
                  step: f.type === "number" ? "any" : void 0,
                  min: f.type === "number" ? 0 : void 0,
                  readOnly: q,
                  value: L[f.key] ?? "",
                  maxLength: 500,
                  onChange: (le) => H(f.key, le.target.value),
                }),
          r("small", {
            children: q
              ? "\u0414\u0430\u0442\u0430 \u0440\u0430\u0441\u0441\u0447\u0438\u0442\u0430\u043D\u0430 \u0438\u0437 \u0441\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u043D\u043D\u044B\u0445 \u0443\u0441\u043B\u043E\u0432\u0438\u0439 \u043F\u0435\u0440\u0435\u0432\u043E\u0437\u0447\u0438\u043A\u0430."
              : eb(f.key),
          }),
        ],
      },
      f.key,
    );
  };
  async function v() {
    (A(!0), y(""));
    try {
      let f = await Ze("/api/route-distance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transport: L.transport,
          addresses: [
            L.origin,
            ...String(L.waypoints || "")
              .split(
                `
`,
              )
              .filter((P) => P.trim()),
            L.destination,
          ],
        }),
      });
      (M((P) => ({ ...P, totalKm: f.km })), W(f.key));
    } catch (f) {
      y(f.message);
    } finally {
      A(!1);
    }
  }
  return o("article", {
    className: "transport-card",
    children: [
      o("div", {
        className: "transport-heading",
        children: [
          r("small", {
            children: "TRANSPORT APPLICATION \xB7 RU / EN",
            translate: "no",
          }),
          r("h2", {
            translate: "no",
            children: he?.request_number || K.order_code,
          }),
          r("p", {
            children:
              To[he?.state] ||
              "\u041E\u0436\u0438\u0434\u0430\u0435\u0442 \u043F\u0440\u0438\u043D\u044F\u0442\u0438\u044F \u0432 \u0440\u0430\u0431\u043E\u0442\u0443",
          }),
          he && r(Cf, { item: K }),
        ],
      }),
      u && r("p", { className: "notice warning", role: "alert", children: u }),
      _ && r("p", { role: "status", children: _ }),
      !he &&
        ne &&
        x &&
        r("button", {
          className: "btn",
          disabled: b || re,
          onClick: () => X("/api/transport-applications", { action: "take" }),
          children:
            "\u0412\u0437\u044F\u0442\u044C \u0437\u0430\u044F\u0432\u043A\u0443 \u0432 \u0440\u0430\u0431\u043E\u0442\u0443",
        }),
      he?.reason &&
        r("p", {
          className: "notice",
          children: "\u0420\u0435\u0448\u0435\u043D\u0438\u0435: " + he.reason,
        }),
      he?.state === "pending" &&
        r("p", {
          className: "notice",
          children:
            "\u0417\u0430\u0434\u0430\u0447\u0430 \u043D\u0430 \u0441\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u043D\u0438\u0435 \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0430 \u0432\u043B\u0430\u0434\u0435\u043B\u044C\u0446\u0443 \u0438 \u0412\u042D\u0414. \u0420\u0435\u0448\u0435\u043D\u0438\u0435 \u043E\u0434\u043D\u043E\u0433\u043E \u0437\u0430\u043A\u0440\u044B\u0432\u0430\u0435\u0442 \u0435\u0451 \u0443 \u043E\u0431\u043E\u0438\u0445.",
        }),
      he &&
        o("details", {
          className: "section",
          open: !h,
          children: [
            r("summary", {
              children:
                "\u0417\u0430\u044F\u0432\u043A\u0430 \u043D\u0430 \u043F\u0435\u0440\u0435\u0432\u043E\u0437\u043A\u0443 \xB7 \u0434\u0430\u043D\u043D\u044B\u0435 \u0438 \u0443\u0441\u043B\u043E\u0432\u0438\u044F",
            }),
            j &&
              !re &&
              x &&
              r("button", {
                className: "btn secondary",
                onClick: () => R(!D),
                children: D
                  ? "\u0417\u0430\u043A\u0440\u044B\u0442\u044C \u0440\u0435\u0434\u0430\u043A\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435"
                  : "\u0420\u0435\u0434\u0430\u043A\u0442\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0437\u0430\u044F\u0432\u043A\u0443",
              }),
            B && x && !re
              ? o("form", {
                  onSubmit: (f) => {
                    f.preventDefault();
                    let P = f.nativeEvent.submitter?.value || "save";
                    if(ne && P === "submit") {const missing=validateTransportApplication(L);if(missing.length){y(documentValidationMessage(missing,md));return;}}
                    X("/api/transport-applications", {
                      action: ne ? P : "edit",
                      details: L,
                      amount: Number(N),
                      currency: S,
                      routeKey: F,
                    });
                  },
                  children: ne ? [renderCompactDocument({r,groups:md,model:d.documentModel||hydrateTransportApplication({item:K,defaults:d.defaults}),values:L,onChange:H,busy:b,onCorrection:note=>X("/api/transport-applications",{action:"correction_request",note})})] : [
                    r("p", {
                      className: "notice",
                      children:
                        "\u0427\u0435\u0440\u043D\u043E\u0432\u0438\u043A \u043C\u043E\u0436\u043D\u043E \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u0447\u0430\u0441\u0442\u044F\u043C\u0438. \u041D\u0430 \u0441\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u043D\u0438\u0435 \u043E\u0442\u043F\u0440\u0430\u0432\u043B\u044F\u0435\u0442\u0441\u044F \u0437\u0430\u043F\u043E\u043B\u043D\u0435\u043D\u043D\u0430\u044F \u0437\u0430\u044F\u0432\u043A\u0430. \u0418\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0435 \u0441\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u043D\u043D\u044B\u0445 \u0434\u0430\u043D\u043D\u044B\u0445 \u043F\u043E\u0442\u0440\u0435\u0431\u0443\u0435\u0442 \u043D\u043E\u0432\u043E\u0433\u043E \u0440\u0435\u0448\u0435\u043D\u0438\u044F.",
                    }),
                    r(Ia, {
                      fields: kf,
                      attached: !0,
                      onApply: (f) => {
                        (M((P) => ({ ...P, ...f })), W(""));
                      },
                    }),
                    ...md.map((f) =>
                      o(
                        "details",
                        {
                          className: "transport-group",
                          open: f[0] === "subject",
                          children: [
                            r("summary", { children: f[1] + " / " + f[2] }),
                            o("div", {
                              className: "grid",
                              children: f[3].map((P) =>
                                C({
                                  key: P[0],
                                  ru: P[1],
                                  en: P[2],
                                  type: P[3],
                                  required: !!P[4],
                                }),
                              ),
                            }),
                          ],
                        },
                        f[0],
                      ),
                    ),
                    o("div", {
                      className: "grid",
                      children: [
                        o("label", {
                          className: "field",
                          children: [
                            "\u0418\u0442\u043E\u0433\u043E\u0432\u0430\u044F \u0441\u0443\u043C\u043C\u0430 \u0434\u043E\u0441\u0442\u0430\u0432\u043A\u0438 *",
                            r("small", {
                              lang: "en",
                              translate: "no",
                              children: "Total freight charge",
                            }),
                            r("input", {
                              type: "number",
                              min: 0,
                              step: "0.01",
                              value: N,
                              disabled: c === "logistic",
                              onChange: (f) => E(f.target.value),
                            }),
                          ],
                        }),
                        o("label", {
                          className: "field",
                          children: [
                            "\u0412\u0430\u043B\u044E\u0442\u0430 \u0434\u043E\u0441\u0442\u0430\u0432\u043A\u0438 *",
                            r("small", {
                              lang: "en",
                              translate: "no",
                              children: "Freight currency",
                            }),
                            r("select", {
                              value: S,
                              disabled: c === "logistic",
                              onChange: (f) => T(f.target.value),
                              children: ["USD", "EUR", "CNY", "BYN", "RUB"].map(
                                (f) =>
                                  r("option", { value: f, children: f }, f),
                              ),
                            }),
                          ],
                        }),
                      ],
                    }),
                    o("div", {
                      className: "bar transport-actions",
                      children: [
                        Ue("route.calculate") &&
                          r("button", {
                            type: "button",
                            className: "btn secondary",
                            disabled: b,
                            onClick: v,
                            children:
                              "\u0420\u0430\u0441\u0441\u0447\u0438\u0442\u0430\u0442\u044C \u0430\u0432\u0442\u043E\u043C\u043E\u0431\u0438\u043B\u044C\u043D\u044B\u0439 \u043C\u0430\u0440\u0448\u0440\u0443\u0442",
                          }),
                        r("button", {
                          className: "btn secondary",
                          name: "action",
                          value: "save",
                          formNoValidate: !0,
                          disabled: b,
                          children:
                            "\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u0447\u0435\u0440\u043D\u043E\u0432\u0438\u043A",
                        }),
                        ne &&
                          r("button", {
                            className: "btn",
                            name: "action",
                            value: "submit",
                            disabled: b,
                            children:
                              "\u041E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C \u0437\u0430\u044F\u0432\u043A\u0443 \u0438 \u0441\u0442\u0430\u0432\u043A\u0443 \u043D\u0430 \u0441\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u043D\u0438\u0435",
                          }),
                      ],
                    }),
                  ],
                })
              : o("div", {
                  children: [
                    ...md.map((f) =>
                      o(
                        "details",
                        {
                          className: "transport-group",
                          open: !1,
                          children: [
                            r("summary", { children: f[1] + " / " + f[2] }),
                            r("dl", {
                              className: "transport-data",
                              children: f[3].map(([P, q, le]) =>
                                o(
                                  "div",
                                  {
                                    children: [
                                      r("dt", { children: q + " / " + le }),
                                      r("dd", {
                                        translate: "no",
                                        children: String(L[P] || "\u2014"),
                                      }),
                                    ],
                                  },
                                  P,
                                ),
                              ),
                            }),
                          ],
                        },
                        f[0],
                      ),
                    ),
                    r("p", {
                      translate: "no",
                      children:
                        "\u0418\u0442\u043E\u0433\u043E\u0432\u0430\u044F \u0441\u0442\u043E\u0438\u043C\u043E\u0441\u0442\u044C / Total freight: " +
                        (he.amount || "\u2014") +
                        " " +
                        he.currency,
                    }),
                  ],
                }),
            c === "logistic" &&
              Ue("applications.approve") &&
              he.state === "pending" &&
              !re &&
              o("div", {
                children: [
                  r("p", {
                    className: "small",
                    children:
                      "\u0421\u0442\u0430\u0432\u043A\u0443 \u0438 \u0438\u0442\u043E\u0433\u043E\u0432\u0443\u044E \u0441\u0442\u043E\u0438\u043C\u043E\u0441\u0442\u044C \u0441\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u044B\u0432\u0430\u0435\u0442 \u0442\u043E\u043B\u044C\u043A\u043E \u0412\u043B\u0430\u0434\u0435\u043B\u0435\u0446.",
                  }),
                  r("button", {
                    className: "btn",
                    disabled:
                      b ||
                      de.data?.applicationReview?.bookingRevision ===
                        he.revision,
                    onClick: () =>
                      X("/api/transport-applications", { action: "review" }),
                    children:
                      de.data?.applicationReview?.bookingRevision ===
                      he.revision
                        ? "\u0417\u0430\u044F\u0432\u043A\u0430 \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u0430; \u043E\u0436\u0438\u0434\u0430\u0435\u0442\u0441\u044F \u0440\u0435\u0448\u0435\u043D\u0438\u0435 \u0412\u043B\u0430\u0434\u0435\u043B\u044C\u0446\u0430 \u043F\u043E \u0441\u0442\u0430\u0432\u043A\u0435"
                        : "\u041F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u0437\u0430\u044F\u0432\u043A\u0443 \u0431\u0435\u0437 \u0441\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u043D\u0438\u044F \u0441\u0442\u0430\u0432\u043A\u0438",
                  }),
                ],
              }),
            c === "owner" &&
              Ue("applications.approve") &&
              he.state === "pending" &&
              !re &&
              o("div", {
                children: [
                  o("div", {
                    className: "bar",
                    children: [
                      r("button", {
                        className: "btn",
                        disabled: b,
                        onClick: () =>
                          X("/api/transport-applications", {
                            action: "approve",
                          }),
                        children:
                          "\u0421\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u0442\u044C \u0437\u0430\u044F\u0432\u043A\u0443 \u0438 \u0441\u0442\u0430\u0432\u043A\u0443",
                      }),
                      r("button", {
                        className: "btn secondary",
                        onClick: () => I("change"),
                        children:
                          "\u0418\u0437\u043C\u0435\u043D\u0438\u0442\u044C \u0441\u0442\u0430\u0432\u043A\u0443",
                      }),
                      r("button", {
                        className: "btn secondary",
                        onClick: () => I("reject"),
                        children:
                          "\u0412\u0435\u0440\u043D\u0443\u0442\u044C \u043D\u0430 \u0434\u043E\u0440\u0430\u0431\u043E\u0442\u043A\u0443",
                      }),
                    ],
                  }),
                  V &&
                    o("form", {
                      onSubmit: (f) => {
                        f.preventDefault();
                        let P = new FormData(f.currentTarget);
                        X("/api/transport-applications", {
                          action: V,
                          amount: Number(P.get("amount")),
                          reason: P.get("reason"),
                        });
                      },
                      children: [
                        V === "change" &&
                          o("label", {
                            className: "field",
                            children: [
                              "\u0418\u0442\u043E\u0433\u043E\u0432\u0430\u044F \u0441\u0443\u043C\u043C\u0430 \u0434\u043E\u0441\u0442\u0430\u0432\u043A\u0438",
                              r("input", {
                                name: "amount",
                                type: "number",
                                min: 0.01,
                                step: 0.01,
                                required: !0,
                                defaultValue: he.amount,
                              }),
                            ],
                          }),
                        o("label", {
                          className: "field",
                          children: [
                            "\u041E\u0431\u043E\u0441\u043D\u043E\u0432\u0430\u043D\u0438\u0435 *",
                            r("textarea", {
                              name: "reason",
                              required: !0,
                              minLength: 10,
                              maxLength: 2e3,
                            }),
                          ],
                        }),
                        r("button", {
                          className: "btn",
                          disabled: b,
                          children:
                            "\u041F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044C \u0440\u0435\u0448\u0435\u043D\u0438\u0435",
                        }),
                      ],
                    }),
                ],
              }),
          ],
        }),
      he &&
        r(tb, {
          item: K,
          docs: G,
          execution: de,
          role: c,
          disabled: b || re,
          onChanged: async () => {
            (await $({ preserveDraft: !0 }), m?.());
          },
          onWaiver: (f, P) =>
            X("/api/shipment-execution", {
              action: "waiver",
              category: f,
              note: P,
            }),
        }),
      he &&
        r(
          nb,
          {
            data: d,
            role: c,
            busy: b || re,
            onSend: (f) => X("/api/shipment-execution", f),
          },
          "execution-" + de.revision,
        ),
      ce &&
        r(
          rb,
          {
            item: K,
            claim: ce,
            docs: G,
            role: c,
            busy: b || re,
            onSend: (f) => X("/api/shipment-execution", f),
          },
          "claim-" + ce.revision,
        ),
      r("a", {
        href: "#approved-shipments",
        className: "btn secondary",
        children:
          "\u041A\u0430\u0440\u0442\u0430 \u0438 \u043E\u0434\u043E\u0431\u0440\u0435\u043D\u043D\u044B\u0435 \u043F\u0435\u0440\u0435\u0432\u043E\u0437\u043A\u0438",
      }),
      r("details", {
        className: "section",
        children: [
          r("summary", {
            children:
              "\u0418\u0441\u0442\u043E\u0440\u0438\u044F \u044D\u0442\u0430\u043F\u043E\u0432 \u0438 \u0440\u0435\u0448\u0435\u043D\u0438\u0439",
          }),
          ...d.events.map((f, P) =>
            r(
              "p",
              {
                className: "small",
                translate: "no",
                children:
                  f.created + " \xB7 " + f.actor + " \xB7 " + f.event_type + correctionEventNote(f),
              },
              P,
            ),
          ),
        ],
      }),
    ],
  });
}