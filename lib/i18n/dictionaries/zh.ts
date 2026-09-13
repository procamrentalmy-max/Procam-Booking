import type { Dictionary } from "./en";

export const zh: Dictionary = {
  common: {
    continue: "继续",
    back: "上一步",
    next: "下一步",
    done: "完成",
    cancel: "取消",
    starting: "正在处理…",
    checking: "正在检查…",
    submitting: "正在提交…",
    processing: "正在处理…",
    somethingWentWrong: "发生错误，请重试。",
    termsAndConditions: "条款与细则",
    bookingNotFound: "找不到该预订。",
  },
  languageToggle: {
    label: "语言",
  },
  home: {
    title: "ProCam",
    subtitle: "扫描酒店前台的二维码，即可租用运动相机或防水手机壳。",
    usp: "🏨 直接送到您的酒店 — 在您入住的地方取件和还件，无需前往门店。",
  },
  landing: {
    brand: "ProCam",
    equipmentRentalAt: (partnerName: string) => `${partnerName} 的设备租赁`,
    noEquipment: "此地点目前尚未提供任何设备。",
    usp: "🏨 直接送到您的酒店 — 在这里取件和还件，无需前往门店。",
  },
  booking: {
    stepTitles: {
      locations: "取件与还件地点",
      contact: "您的资料",
      phone: "检查您的手机",
      verify: "身份验证",
      confirm: "确认预订",
      booked: "预订已确认",
    },
    table: { duration: "时长", price: "价格" },
    mode: { daytime: "日间", overnight: "过夜", multiday: "多日" },
    hint: {
      overnight: "晚上10点取件，早上8点前归还 — 预订需至少提前2小时。",
      daytime: "先选择日期，再从时间表中选择开始和结束时间 — 预订需至少提前2小时。如果您想要的时段已被预订，我们会为您提供最接近的可用时段。",
      multiday: "选择日期和开始时间，然后选择您需要的天数 — 预订需至少提前2小时。",
    },
    timetable: {
      tapStart: "点选开始时间",
      tapEnd: "现在点选结束时间",
      tapRestart: "点选任意时间可重新选择",
      chooseDuration: "选择时长",
    },
    locations: {
      hint: "可在同一地点取件和还件，或选择不同地点进行单程租赁。",
      pickup: "取件地点",
      dropoff: "还件地点",
    },
    contact: {
      namePlaceholder: "全名",
      phonePlaceholder: "电话号码（含国家代码，例如 +60123456789）",
      emailPlaceholder: "电子邮箱",
    },
    phone: {
      compatibilityHint: (productName: string) => `${productName} 需搭配您自己的手机使用 — 在继续之前，让我们先确认兼容性。`,
      manufacturerPlaceholder: "品牌，例如 Apple",
      modelPlaceholder: "型号，例如 iPhone 16 Pro Max",
      variantPlaceholder: "版本（选填）",
      compatible: "您的手机兼容。",
      incompatible: (productName: string) =>
        `我们无法确认此手机与 ${productName} 兼容。请尝试使用其他手机 — 在兼容性未确认的情况下，我们无法为您办理此租赁。`,
      checkCompatibility: "检查兼容性",
    },
    verify: {
      hint: "请验证您的身份以继续 — 您需要拍摄证件照片并完成快速自拍。",
      start: "开始验证",
      skipDev: "跳过验证（仅限开发测试）",
    },
    confirm: {
      requestedPickup: (time: string) => `预定取件时间：${time}`,
      pickup: (name: string) => `取件地点：${name}`,
      dropoffSuffix: (name: string) => ` — 还件地点：${name}`,
      rentalFee: (price: number | string) => `租赁费：RM${price}`,
      deposit: (deposit: number | string) => `可退还的安全押金：RM${deposit}`,
      agreementPrefix: "本人同意以上 ProCam 租赁条款，包括在设备归还并经检查确认前，对设备及其配件承担责任，并同意完整的",
      agreementSuffix: "。",
      continueToPayment: "前往付款",
      reserving: "正在预订…",
    },
    booked: {
      notAvailable: "您所要求的时段暂不可用，我们已为您预订了下一个可用时段：",
      until: (time: string) => `至 ${time}`,
    },
    errors: {
      selectPackage: "请选择一个租赁套餐。",
      minNotice: (hours: number) => `预订需至少提前 ${hours} 小时通知 — 请选择较晚的时间。`,
      selectLocations: "请选择取件和还件地点。",
      verificationNotApproved: "我们无法通过您的身份验证，请重试。",
      verificationFailed: "验证失败，请重试。",
    },
  },
  bookingServer: {
    couldNotStartBooking: "无法开始您的预订，请重试。",
    couldNotStartVerification: "无法开始身份验证，请重试。",
    verificationNotFound: "找不到验证记录，请重新开始。",
    verificationSessionMissing: "验证会话缺失，请重新开始。",
    devNotAvailable: "此功能不可用。",
    verificationRequired: "预订前必须完成身份验证。",
    invalidDateTime: "请选择有效的日期和时间。",
    noAssetAvailable: "该时段和地点暂无可用设备。",
  },
  dashboard: {
    bookingLabel: (humanId: string) => `预订 ${humanId}`,
    statusLabels: {
      PENDING_PAYMENT: "待付款",
      READY_FOR_PICKUP: "可供取件",
      ACTIVE: "租赁中",
      RETURN_STARTED: "归还处理中",
      AWAITING_INSPECTION: "等待验收",
      INSPECTION: "验收中",
      DAMAGE_REVIEW: "损坏审核中",
      COMPLETED: "已完成",
      CANCELLED: "已取消",
      EXPIRED: "已过期",
      CONFIRMED: "已确认",
    },
    confirmedAt: (time: string) => `一切就绪。请于 ${time} 前往储物柜取件。`,
    confirmedNow: "一切就绪。请在储物柜出示此页面以取件。",
    statusMessages: {
      PENDING_PAYMENT: "付款尚未完成。",
      READY_FOR_PICKUP: "您的设备已可在储物柜取件。",
      ACTIVE: "您的租赁正在进行中，尽情体验吧！",
      RETURN_STARTED: "请立即将设备放回储物柜。",
      AWAITING_INSPECTION: "感谢您归还设备。您的押金将保留，直至 ProCam 工作人员完成检查。",
      INSPECTION: "您的设备正在接受检查。",
      DAMAGE_REVIEW: "检查中发现问题，我们的团队将就您的押金与您联系。",
      COMPLETED: "本次租赁已完成，感谢您使用 ProCam！",
      CANCELLED: "此预订已被取消。",
      EXPIRED: "此预订因未完成付款而已过期。",
    },
    completePayment: "完成付款",
    startPickupCheck: "开始取件检查",
    viewInstructions: "查看使用说明",
    beginReturn: "开始归还",
    row: {
      pickup: "取件地点",
      dropoff: "还件地点",
      package: "套餐",
      equipment: "设备",
      start: "开始时间",
      returnBy: "归还截止时间",
    },
  },
  rating: {
    thanks: "感谢您的反馈！",
    question: "您的租赁体验如何？",
    rateAria: (value: number) => `评价 ${value} 星（满分5星）`,
  },
  ratingServer: {
    notRateable: "此预订暂时还不能评价。",
    alreadyRated: "此预订已评价过。",
  },
  instructionsCarousel: {
    ofCount: (index: number, total: number) => `第 ${index} 步，共 ${total} 步`,
    instructionsFallback: "使用说明",
    noInstructionsYet: "暂无使用说明",
  },
  pay: {
    title: "付款与确认",
    summary: (name: string, price: number | string, deposit: number | string) =>
      `${name} — 现需支付租赁费 RM${price}。付款后将立即在同一张卡上预留可退还押金 RM${deposit} — 您无需重复付款。`,
    unavailable: "目前无法进行付款。",
    devSkip: "[开发测试] 跳过付款 — 绕过 Stripe",
  },
  paymentForm: {
    payNow: "立即付款",
    failed: "付款失败，请重试。",
  },
  payServer: {
    alreadyPaid: "此预订已完成付款。",
  },
  pickup: {
    stepOf: (step: number, total: number) => `第 ${step} 步，共 ${total} 步`,
    confirmAndStart: "确认并开始租赁",
    startRental: "开始租赁",
    startingRental: "正在开始租赁…",
  },
  pickupServer: {
    notReady: "此预订尚未可以取件。",
    noProduct: "无法确定此预订对应的租赁产品。",
    noCheckConfigured: "此产品尚未设置检查项目。",
    confirmPrefix: "请确认：",
    photoPrefix: "请添加照片：",
    saveFailed: "无法保存您的检查记录，请重试。",
    depositFailed: "无法在您的卡上预授权押金。请换一张卡，或联系工作人员协助。",
  },
  returnCheck: {
    stepOf: (step: number, total: number) => `第 ${step} 步，共 ${total} 步`,
    confirmTitle: "确认",
    issuesTitle: "有任何问题吗？",
    lateFeeWarning: (amount: string) => `此次归还已逾期 — 将从您的押金中至少扣除 RM${amount} 逾期费。`,
    damageQuestion: "设备或配件是否存在任何已知损坏或问题？",
    noIssues: "没有问题",
    reportIssue: "报告问题",
    describePlaceholder: "请描述发生的情况",
    completeReturn: "完成归还",
  },
  returnServer: {
    notActive: "此预订当前不在租赁中状态。",
    noProduct: "无法确定此预订对应的租赁产品。",
    noCheckConfigured: "此产品尚未设置归还检查项目。",
    confirmPrefix: "请确认：",
    photoPrefix: "请添加照片：",
    saveFailed: "无法保存您的检查记录，请重试。",
  },
  camera: {
    notAvailable: "此浏览器不支持相机访问。",
    cantAccess: "无法访问相机。请检查浏览器的相机权限后重试。",
    cantProcess: "无法处理该照片，请重试。",
    capture: "拍摄",
    addAnotherPhoto: "添加另一张照片",
    tapToTakeAPhoto: "点击拍照",
    tapToTakePhoto: "点击拍照",
    retake: "重新拍摄",
    removePhoto: "删除照片",
  },
  terms: {
    title: "条款与细则",
    lastUpdated: "最后更新：2026年9月13日。",
    sections: [
      {
        title: "一、服务说明",
        paragraphs: [
          "ProCam 在马来西亚兰卡威的合作地点，通过自助式智能储物柜提供运动相机及防水设备租赁服务。预订、付款、取件与归还均通过每个储物柜二维码所链接的预订页面完成 — 现场没有柜台或工作人员。",
        ],
      },
      {
        title: "二、资格要求",
        paragraphs: ["您必须年满18岁，并具备订立具约束力协议的能力方可预订租赁服务。完成预订即表示您确认符合上述条件。"],
      },
      {
        title: "三、预订、定价与付款",
        paragraphs: [
          "预订时显示的价格按所选租赁时长计算，以马来西亚令吉（MYR）收取。预订须至少提前2小时。系统将先收取租赁费，随后立即在同一付款方式上预留一笔单独的、可退还的安全押金 — 您无需重复付款。若预订在短时间内未完成付款，将自动取消，设备将重新释放供其他客户预订。",
        ],
      },
      {
        title: "四、身份验证",
        paragraphs: [
          "预订前，您必须完成身份验证步骤（提供政府颁发的证件及实时自拍照，由我们的验证服务商处理）。此举用于确认您是真实存在、可在租赁期间对设备负责的自然人。我们本身不会人工审核或存储您证件的副本 — 有关此类数据的处理方式，请参阅下方的{privacyLink}部分。",
        ],
      },
      {
        title: "五、取件、使用与归还",
        paragraphs: [
          "自您打开储物柜箱格起，直至 ProCam 工作人员检查并确认接收归还为止，您需对设备及其套件内的所有物品（线材、包装盒、配件）负责。请仅按预定用途、仅在预订时长内使用设备。每个产品页面均列有具体的操作说明（例如防水壳的密封检查）— 遵循这些说明是您的责任，ProCam 无法远程验证您是否已遵循。",
          "请在预订的结束时间前将设备归还至自助储物柜。逾期归还将按您预订时该租赁套餐所列的逾期费率，按小时或不足一小时计收逾期费。",
        ],
      },
      {
        title: "六、安全押金、损坏与遗失",
        paragraphs: [
          "安全押金可退还，并在工作人员检查归还的设备后予以释放。若设备归还时已损坏、缺少部件，或完全未归还，ProCam 可能扣留部分或全部押金，以支付维修、更换或损失的费用。若该费用超出押金金额，您仍需对差额负责，并可能被另行收取费用。",
          "特别就防水壳而言：押金及任何损坏评估仅涵盖 ProCam 所拥有的防水壳及其套件本身。若因防水壳密封失效导致您自己的手机或设备（包括进水）受损，ProCam 概不负责 — 在下水前遵循系统引导的密封检查步骤，是您的责任。",
        ],
      },
      {
        title: "七、取消与变更",
        paragraphs: [
          "如需取消或更改已确认的预订，请尽快通过您的预订页面联系 ProCam 客服。退款资格取决于提前通知的时间长短，以及设备是否已为您的取件做好准备。",
        ],
      },
      {
        title: "八、禁止行为",
        paragraphs: [
          "您不得将设备转租、转售或转借他人，不得自行尝试维修，不得移除或改动任何追踪或资产标签，亦不得将设备用于任何非法用途。违反上述规定将导致押金退款失效，并可能产生额外费用。",
        ],
      },
      {
        title: "九、责任限制",
        paragraphs: [
          "ProCam 按设备现状提供租赁服务，对因使用设备而产生的间接、附带或衍生损害（包括内容丢失、错过的时刻或第三方索赔）概不负责，其赔偿责任上限为该预订实际支付的租赁费与押金总额。本条款不限制根据马来西亚法律不可限制的责任。",
        ],
      },
      {
        title: "十、隐私",
        paragraphs: [
          "我们收集您的姓名、电话号码及电子邮箱，用于创建和管理您的预订，并通过我们的身份验证服务商处理证件及自拍照，以确认您符合预订资格。付款信息由我们的付款处理商直接处理 — ProCam 从不查看或存储您的银行卡号。上述信息仅用于预订、验证、客户支持及法律/合规目的，并按照马来西亚《个人数据保护法》（PDPA）的规定进行处理。",
        ],
      },
      {
        title: "十一、适用法律",
        paragraphs: ["本条款受马来西亚法律管辖。因预订产生的任何争议，均受马来西亚法院的专属管辖。"],
      },
      {
        title: "十二、联系我们",
        paragraphs: ["如对本条款或您当前/过往的预订有任何疑问，请通过您的预订页面向 ProCam 客服发送消息。"],
      },
    ],
    privacyLinkText: "隐私",
  },
};
