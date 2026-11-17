/* Static current Task2 help; customer values are never translated. */
window.task2HelpLocales={
  "en": {
    "title": "Task 2 · Complete shipment workflow",
    "intro": "Use the information icon next to a field for instructions. These answers explain the shared workflow for all roles.",
    "general": "Enter the value required by this field. Review the information icon and the workflow FAQ before saving.",
    "hints": [
      "Enter all linked Bitrix task numbers (up to 20). They are inherited by related workspaces and documents; the registration number does not replace them.",
      "Company order number, such as C26EM080961. It is different from the TR registration number and remains linked to child tasks.",
      "Factory or warehouse contact: name, phone, email or WeChat. Optional; visible to the carrier receiving the request.",
      "Country, city and actual factory or warehouse address. Routes and distances use verified addresses when available.",
      "Final delivery warehouse or terminal, for example Kolyadichi, Minsk.",
      "List intermediate terminals, stations, ports and border crossings separately, in travel order.",
      "Select the applicable Incoterms 2020 rule and specify the named place or port in the contract.",
      "Planned supplier cargo-ready date, not actual departure or customs clearance.",
      "End of ordinary quote submission in Minsk time. Late quotes are handled separately before a winner is selected.",
      "Select Yes, No or Unknown. For dangerous goods, attach applicable safety documents, hazard class details and permits.",
      "Total cargo volume in cubic metres, for example 8.45 m³.",
      "Gross weight of the whole shipment including packaging, in kilograms; not the net weight of one item.",
      "The container number is optional in transit. At closure, foreign trade staff or the owner either waives it or requests it from the carrier.",
      "Actual departure cannot be in the future. Correct an invalid historical date with a reason and audit; only trusted departure blocks rescheduling.",
      "The initial planned date is immutable. Add each rescheduled date using + and provide a reason.",
      "Current cargo location and observation time. Every checkpoint is retained in the history.",
      "Enter the quote amount and currency. After winner selection they are copied automatically and are not approved again.",
      "Planned transit time and estimated arrival are forecasts, not actual dates.",
      "Foreign trade staff records the actual customer warehouse receipt date; it becomes visible to the carrier.",
      "Select one or more files, wait for upload confirmation and check the list before completing the task.",
      "Explain the factual reason for a change, refusal or claim. The decision and date remain in the audit log.",
      "Describe the incident, evidence, claim amount and transport mode. Only foreign trade staff or the owner closes a shipment with claim history.",
      "Enter dimensions and units (mm/cm). Check the converted result when automatic conversion is used.",
      "Select the quote currency. It cannot be changed during execution after winner selection.",
      "Ordered route points, stations, ports and border crossings; not just the factory address.",
      "Driver and vehicle details apply to road transport. Do not use these fields for rail, air or sea transport.",
      "Attach a valid document for the specific product, or explain why it is not yet available.",
      "This comment is saved with the specific task and is visible only to its authorized participants."
    ],
    "faq": [
      [
        "How do requests relate to execution?",
        "The owner publishes a request, carriers submit quotes, and only the owner selects one winning offer. Execution starts separately when that selected carrier takes the shipment."
      ],
      [
        "Is participation approval the same as winner selection?",
        "No. Approving participation admits the carrier to consideration. It does not select a price or authorize execution. Only the owner's explicit choice of one offer creates a winner."
      ],
      [
        "Why have a TR number as well as order and Bitrix numbers?",
        "TR is the immutable annual shipment registration number. The company order and every linked Bitrix number remain in related tasks and documents. Test registrations use the TEST- prefix."
      ],
      [
        "What happens at the deadline?",
        "Ordinary submission closes. Late preparation is separate from execution and remains visible to the owner. A winner cannot be selected while an active late draft exists. A reasoned refusal is not a non-response; Service Level penalties must not be repeated."
      ],
      [
        "What becomes available after taking a shipment?",
        "Document requests, uploads, up to four reasoned planned-date changes, actual departure, dated tracking and shipment stages are available. A separate transport application remains deferred."
      ],
      [
        "How do document requests work?",
        "Describe the required documents. A new request creates an assigned task; retrying the same operation does not duplicate it. Files are stored with the shipment or addressed task. To send a file in conversation, attach it in Shipment chats."
      ],
      [
        "Why is the initial departure date locked?",
        "The original date comes from the selected bid. Up to four reasoned reschedules preserve history and are available until real departure. Future actual departure is rejected. Correct an invalid historical date with a reason and audit; it does not block planning."
      ],
      [
        "How do tracking and the map work?",
        "One Global View shows the plan, every dated report and the latest position. 3D and 2D share the same points. A 65-day journey has ten weekly rows; reminders remain neutral before real departure. Station coordinates are verified on the server; road OSRM is not used for rail."
      ],
      [
        "What happens at inspection?",
        "Before PTO there is one VED review: verified remaining distance below 1000 km or the documented Owner fallback. VED approves a complete correct package or sends remarks to the existing chat. Remarks keep the same task open until recheck. Arrival does not create another review."
      ],
      [
        "How are customs and warehouse receipt recorded?",
        "After real departure and positive VED review the carrier records PTO, customs and warehouse dates. Customs is blocked until review. No separate VED checks are created for arrival, customs or warehouse. Completion requires all agreed stages and document tasks."
      ],
      [
        "Is a container number mandatory?",
        "Not during transit. At closure, staff or the owner chooses to request it or close without it. For a clean shipment, arrival of a requested number closes it only when every other required stage is complete."
      ],
      [
        "How are claims handled?",
        "Reports follow the transport mode: road, rail, air or sea. Evidence and revisions are retained. The carrier agrees or disputes with a reason. A shipment with any claim history is closed only by foreign trade staff or the owner."
      ],
      [
        "How do I import a long form from CSV?",
        "Download its template, fill editable values, upload, inspect the mapping and confirm. Then use the normal Save action. Protected source data, winning prices and TR identifiers cannot be changed. Import is audited only when the server saves it successfully."
      ],
      [
        "Why is each action available in one place?",
        "An action has one canonical section. Other sections link to it rather than duplicating handlers: quotes in review, execution in execution, the transport application as its document, and claims in reports."
      ]
    ]
  },
  "zh": {
    "title": "任务2 · 完整运输流程",
    "intro": "点击字段旁的信息图标查看说明。以下问答适用于各角色的统一流程。",
    "general": "请按字段用途填写，保存前查看信息图标及流程常见问题。",
    "hints": [
      "填写所有关联的 Bitrix 任务编号（最多20个）。相关工作区和文件自动继承，登记编号不能替代它们。",
      "公司订单号，例如 C26EM080961。它不同于 TR 登记编号，并保留在子任务中。",
      "工厂或仓库联系人的姓名、电话、邮箱或微信。此项可选，收到申请的承运商可以查看。",
      "填写国家、城市及工厂或仓库的实际地址。可用时根据已确认地址计算路线和距离。",
      "最终交付的具体仓库或场站，例如明斯克科利亚季奇。",
      "按运输顺序分别填写中转场站、车站、港口及边境口岸。",
      "选择适用的 Incoterms 2020 条款，并在合同中明确指定地点或港口。",
      "供应商计划货妥日期，不是实际发运或清关日期。",
      "普通报价截止时间采用明斯克时区。确定中选报价前，逾期报价通过独立流程处理。",
      "选择是、否或未知。危险品须提供适用的安全资料、危险类别及许可文件。",
      "整批货物体积，单位为立方米，例如 8.45 m³。",
      "整批货物连同包装的毛重，单位为千克，不是单件净重。",
      "在途时箱号可选。结束时外贸人员或所有者决定免填或要求承运商补充。",
      "实际发运时间不得晚于当前时间。历史错误日期修正必须填写原因并记录审计；只有可信的实际发运才会阻止计划调整。",
      "最初计划日期不可更改。每次延期请通过加号新增日期并填写原因。",
      "货物当前位置及信息时间。每个节点均保留在历史记录中。",
      "填写报价金额及币种。确定中选报价后自动继承，不重复审批。",
      "计划运输时长和预计到达日期属于预测，并非实际日期。",
      "外贸人员记录客户仓库实际签收日期，承运商可自动查看。",
      "可选择多个文件。等待上传确认，并在完成任务前检查文件列表。",
      "说明变更、拒绝或索赔的实际原因。决定和日期保留在审计记录中。",
      "填写事件、情况、证据、索赔金额及运输方式。有索赔历史的运输只能由外贸人员或所有者结束。",
      "填写尺寸及单位（毫米或厘米）。自动换算后请核对结果。",
      "选择报价币种。确定中选报价后，执行阶段不能更改。",
      "按顺序填写路线节点、车站、港口及口岸，不要仅填写工厂地址。",
      "司机及车辆信息仅适用于公路运输，不适用于铁路、航空或海运。",
      "为具体产品提供有效文件；暂未取得时请说明原因。",
      "备注保存在具体任务中，仅向具有权限的参与者显示。"
    ],
    "faq": [
      [
        "申请与运输执行有何关系？",
        "所有者发布申请，承运商提交报价，只有所有者可以选定一个中选报价。中选承运商单独接受运输后才进入执行阶段。"
      ],
      [
        "同意参与是否等于选定中选方？",
        "不是。同意参与只是允许承运商参加比较，不代表批准价格或授权执行。只有所有者明确选择一份报价才能确定中选方。"
      ],
      [
        "已有订单号和 Bitrix 编号，为何还需要 TR 编号？",
        "TR 是按年度生成且不可更改的运输登记编号。公司订单号和全部 Bitrix 编号继续保留在关联任务和文件中。测试编号带有 TEST- 前缀。"
      ],
      [
        "截止时间后会发生什么？",
        "普通报价关闭。逾期准备与运输执行分开，并向所有者显示。存在有效逾期草稿时不能选定中选方。说明原因的拒绝不属于未回复，Service Level 不得重复扣分。"
      ],
      [
        "接受运输后可以做什么？",
        "接受运输后可以请求和上传文件、填写最多四次有原因的计划日期调整、实际发运时间、带日期的跟踪记录和运输阶段。单独的运输申请功能仍然暂缓。"
      ],
      [
        "如何请求外贸文件？",
        "说明需要的文件，新请求会生成指定任务；重复提交同一操作不会创建副本。文件保存在运输记录或指定任务中。如需在会话中发送文件，请在运输聊天中附加。"
      ],
      [
        "为何最初发运日期被锁定？",
        "原计划日期来自中选报价。实际发运前最多可填写四次有原因的调整，历史记录保留。实际发运时间不得晚于当前时间。历史错误日期不会阻止计划调整，修正必须填写原因并记录审计。"
      ],
      [
        "跟踪与地图如何工作？",
        "统一Global View显示计划、全部带日期的报告及最新位置，3D和2D使用相同数据。65天对应十个周记录行；实际发运前提示保持中性。车站坐标由服务器核实，铁路不使用公路OSRM里程。"
      ],
      [
        "到达检验点后如何处理？",
        "到达PTO前只有一次外贸文件审核：确认剩余距离少于1000公里，或由货主在记录无法计算原因后手动启动。外贸确认文件完整正确，或在原聊天中发送意见。存在意见时原任务保持未完成，等待重新检查；到达PTO不新增审核。"
      ],
      [
        "如何登记清关和入库？",
        "实际发运并通过外贸审核后，承运商记录PTO、清关及入库日期。审核通过前禁止清关。PTO、清关和仓库不会分别生成外贸审核任务。完成运输必须满足全部约定阶段及文件任务。"
      ],
      [
        "必须提供箱号吗？",
        "在途期间不必填写。结束时外贸人员或所有者选择请求箱号或免填结束。无索赔运输仅在所有其他必需阶段完成后，才能因补充所请求的箱号而自动结束。"
      ],
      [
        "索赔如何处理？",
        "按公路、铁路、航空或海运编制报告，保留证据和版本。承运商同意或说明原因提出异议。任何有索赔历史的运输只能由外贸人员或所有者最终结束。"
      ],
      [
        "如何用 CSV 填写长表单？",
        "下载对应模板，填写可编辑值，上传后检查映射并确认，再使用正常保存操作。不能修改受保护的原始资料、中选价格和 TR 编号。只有服务器成功保存后才记录导入审计。"
      ],
      [
        "为何每项操作只保留一个入口？",
        "每项操作只有一个主入口，其他页面提供链接而不重复处理逻辑：报价在审核页面，执行在运输执行页面，运输申请作为文件，索赔在报告中处理。"
      ]
    ]
  }
};
