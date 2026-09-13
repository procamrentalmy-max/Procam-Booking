import type { Dictionary } from "./en";

export const ms: Dictionary = {
  common: {
    continue: "Teruskan",
    back: "Kembali",
    next: "Seterusnya",
    done: "Selesai",
    cancel: "Batal",
    starting: "Memulakan…",
    checking: "Menyemak…",
    submitting: "Menghantar…",
    processing: "Memproses…",
    somethingWentWrong: "Ralat berlaku. Sila cuba lagi.",
    termsAndConditions: "Terma & Syarat",
    bookingNotFound: "Tempahan tidak dijumpai.",
  },
  languageToggle: {
    label: "Bahasa",
  },
  home: {
    title: "ProCam",
    subtitle: "Imbas kod QR di kaunter penerimaan hotel anda untuk menyewa kamera aksi atau sarung telefon kalis air.",
    usp: "🏨 Dihantar ke hotel anda — ambil dan pulangkan di tempat anda menginap, tanpa perlu ke kedai.",
  },
  landing: {
    brand: "ProCam",
    equipmentRentalAt: (partnerName: string) => `Sewaan peralatan di ${partnerName}`,
    noEquipment: "Tiada peralatan disediakan di lokasi ini buat masa ini.",
    usp: "🏨 Dihantar ke hotel anda — ambil dan pulangkan di sini juga, tanpa perlu ke kedai.",
    printService: {
      name: "Cetak Gambar Saya",
      tagline: "Muat naik dari telefon anda — dicetak & dihantar ke hotel anda",
    },
  },
  // TODO: translate — Photo Print is still being built; English placeholder
  // text so the type checker passes and BM viewers see something correct,
  // not garbled. Real translation comes once the feature is finished.
  printPage: {
    title: "Print My Photos",
    intro: "Upload photos straight from your phone — we print them and deliver to your hotel, no shop visit needed.",
    turnaround: "Uploaded before 5pm: delivered the next day. After 5pm: delivered in 2 days.",
    table: { size: "Size", quantity: "Quantity", price: "Price" },
    sizeLabel: { "3R": "3R (3.5×5\")", "4R": "4R (4×6\")" },
    quantityLabel: (qty: number) => `${qty} prints`,
    freeLine: (hotelName: string) => `Free — courtesy of ${hotelName}`,
    chooseSize: "Size",
    chooseQuantity: "How many prints?",
    printsHeading: "Your Prints",
    printsHint: "Tap a print to add 1 photo, or a 2-photo collage.",
    slotEmpty: "Add",
    slotEdit: "Edit",
    slotRemove: "Remove",
    slotsReady: (count: number, needed: number) => `${count} of ${needed} ready`,
    continueToReview: "Review Order",
    reviewHeading: "Review Your Prints",
    namePlaceholder: "Full name",
    phonePlaceholder: "Phone number, with country code, e.g. +60123456789",
    emailPlaceholder: "Email (optional)",
    summaryTotal: (total: number | string) => `Total: RM${total}`,
    submit: "Submit Order",
    submitting: "Submitting…",
  },
  collageEditor: {
    chooseLayout: "Layout",
    layoutSingle: "1 Photo",
    layoutSplitH: "2 Photos — Stacked",
    layoutSplitV: "2 Photos — Side by Side",
    twoPhotoWarning:
      "Fitting two photos into one print makes each photo smaller — fine to print, but faces or fine detail may be harder to see up close.",
    addPhoto: "Add Photo",
    dragHint: "Drag to reposition",
    usePhoto: "Use This Photo",
    cancel: "Cancel",
    processing: "Processing…",
    compositeFailed: "Could not process this photo. Please try again.",
  },
  photoPrintConfirm: {
    title: "Order Received",
    freeBody: (hotelName: string) => `Your photos are on the way to print, courtesy of ${hotelName}.`,
    paidBody: "Payment received — your photos are on the way to print.",
    turnaround: "Uploaded before 5pm: delivered to your hotel the next day. After 5pm: within 2 days.",
    back: "Back to hotel page",
    readyTitle: "Ready for Pickup",
    readyBody: (slotNumber: number, hotelName: string) => `Collect before 10:30am at Slot ${slotNumber} at ${hotelName}.`,
    askReception: "Please ask reception if you don't know where the pickup slots are.",
    boxWarning: (time: string) => `Photos not collected within 24 hours (by ${time}) will be put into the wooden box.`,
    movedToBoxTitle: "Moved to the Wooden Box",
    movedToBoxBody: (hotelName: string) => `Your prints are in the wooden box at ${hotelName}, not a numbered slot.`,
    cancelledTitle: "Order Cancelled",
    cancelledBody: "This order was cancelled.",
  },
  photoPrintPay: {
    title: "Pay for Your Prints",
    summary: (quantity: number, size: string, total: number | string) => `${quantity} × ${size} photos — RM${total} total`,
    unavailable: "Payment isn't available right now.",
  },
  photoPrintServer: {
    hotelUnavailable: "This hotel isn't available right now.",
    wrongPhotoCount: (needed: number) => `Please upload exactly ${needed} photos.`,
    orderFailed: "Could not create your order. Please try again.",
    alreadyPaid: "This order has already been paid.",
  },
  booking: {
    stepTitles: {
      locations: "Pengambilan & Penghantaran",
      contact: "Butiran Anda",
      phone: "Semak Telefon Anda",
      verify: "Sahkan Identiti Anda",
      confirm: "Sahkan Tempahan",
      booked: "Tempahan Disahkan",
    },
    table: { duration: "Tempoh", price: "Harga" },
    mode: { daytime: "Siang", overnight: "Semalaman", multiday: "Berbilang Hari" },
    hint: {
      overnight: "Ambil pada jam 10 malam, pulangkan sebelum jam 8 pagi — tempahan memerlukan sekurang-kurangnya 2 jam notis.",
      daytime:
        "Pilih tarikh, kemudian masa mula dan masa tamat daripada jadual waktu — tempahan memerlukan sekurang-kurangnya 2 jam notis. Jika slot pilihan anda tidak tersedia, kami akan tawarkan slot terdekat yang seterusnya.",
      multiday:
        "Pilih tarikh dan masa mula, kemudian pilih berapa hari yang anda perlukan — tempahan memerlukan sekurang-kurangnya 2 jam notis.",
    },
    timetable: {
      tapStart: "Ketik masa mula",
      tapEnd: "Kini ketik masa tamat",
      tapRestart: "Ketik mana-mana masa untuk mula semula",
      chooseDuration: "Pilih tempoh",
    },
    locations: {
      hint: "Ambil dan pulangkan di lokasi yang sama, atau pilih lokasi berbeza untuk sewaan sehala.",
      pickup: "Pengambilan",
      dropoff: "Penghantaran",
    },
    contact: {
      namePlaceholder: "Nama penuh",
      phonePlaceholder: "Nombor telefon, dengan kod negara, cth. +60123456789",
      emailPlaceholder: "E-mel",
    },
    phone: {
      compatibilityHint: (productName: string) =>
        `${productName} berfungsi dengan telefon anda sendiri — mari kita semak keserasiannya sebelum anda meneruskan.`,
      manufacturerPlaceholder: "Pengeluar, cth. Apple",
      modelPlaceholder: "Model, cth. iPhone 16 Pro Max",
      variantPlaceholder: "Varian (pilihan)",
      compatible: "Telefon anda serasi.",
      incompatible: (productName: string) =>
        `Kami tidak dapat mengesahkan telefon ini berfungsi dengan ${productName}. Sila cuba telefon lain — kami tidak boleh membuat tempahan ini dengan keserasian yang belum disahkan.`,
      checkCompatibility: "Semak Keserasian",
    },
    verify: {
      hint: "Sahkan identiti anda untuk meneruskan — anda akan mengambil gambar kad pengenalan dan swafoto ringkas.",
      start: "Mula Pengesahan",
      skipDev: "Langkau Pengesahan (pembangunan sahaja)",
    },
    confirm: {
      requestedPickup: (time: string) => `Pengambilan diminta: ${time}`,
      pickup: (name: string) => `Pengambilan: ${name}`,
      dropoffSuffix: (name: string) => ` — Penghantaran: ${name}`,
      rentalFee: (price: number | string) => `Yuran sewaan: RM${price}`,
      deposit: (deposit: number | string) => `Deposit keselamatan yang boleh dikembalikan: RM${deposit} (ditahan semasa pengambilan, bukan sekarang)`,
      agreementPrefix:
        "Saya bersetuju dengan terma sewaan ProCam di atas, termasuk tanggungjawab terhadap peralatan dan aksesori sehingga dipulangkan dan diperiksa, dan dengan ",
      agreementSuffix: " yang lengkap.",
      continueToPayment: "Teruskan ke Pembayaran",
      reserving: "Menempah…",
    },
    booked: {
      notAvailable: "Waktu yang anda minta tidak tersedia, jadi kami telah menempahkan slot terbuka seterusnya untuk anda:",
      until: (time: string) => `sehingga ${time}`,
    },
    errors: {
      selectPackage: "Pilih pakej sewaan.",
      minNotice: (hours: number) => `Tempahan memerlukan sekurang-kurangnya ${hours} jam notis — sila pilih masa yang lebih lewat.`,
      selectLocations: "Pilih lokasi pengambilan dan penghantaran.",
      verificationNotApproved: "Kami tidak dapat meluluskan pengesahan anda. Sila cuba lagi.",
      verificationFailed: "Pengesahan gagal. Sila cuba lagi.",
    },
  },
  bookingServer: {
    couldNotStartBooking: "Tidak dapat memulakan tempahan anda. Sila cuba lagi.",
    couldNotStartVerification: "Tidak dapat memulakan pengesahan. Sila cuba lagi.",
    verificationNotFound: "Pengesahan tidak dijumpai. Sila mula semula.",
    verificationSessionMissing: "Sesi pengesahan tiada. Sila mula semula.",
    devNotAvailable: "Tidak tersedia.",
    verificationRequired: "Pengesahan identiti diperlukan sebelum membuat tempahan.",
    invalidDateTime: "Sila pilih tarikh dan masa yang sah.",
    noAssetAvailable: "Tiada peralatan tersedia untuk masa dan lokasi tersebut.",
  },
  dashboard: {
    bookingLabel: (humanId: string) => `Tempahan ${humanId}`,
    statusLabels: {
      PENDING_PAYMENT: "Menunggu Pembayaran",
      READY_FOR_PICKUP: "Sedia Untuk Diambil",
      ACTIVE: "Aktif",
      RETURN_STARTED: "Pemulangan Dimulakan",
      AWAITING_INSPECTION: "Menunggu Pemeriksaan",
      INSPECTION: "Pemeriksaan",
      DAMAGE_REVIEW: "Semakan Kerosakan",
      COMPLETED: "Selesai",
      CANCELLED: "Dibatalkan",
      EXPIRED: "Tamat Tempoh",
      CONFIRMED: "Disahkan",
    },
    confirmedAt: (time: string) => `Semuanya sedia. Kembali pada ${time} untuk mengambil peralatan anda di lokar.`,
    confirmedNow: "Semuanya sedia. Tunjukkan halaman ini di lokar untuk mengambil peralatan anda.",
    statusMessages: {
      PENDING_PAYMENT: "Pembayaran belum selesai lagi.",
      READY_FOR_PICKUP: "Peralatan anda sedia untuk diambil di lokar.",
      ACTIVE: "Sewaan anda sedang berlangsung. Selamat menikmati!",
      RETURN_STARTED: "Sila masukkan semula peralatan anda ke dalam lokar sekarang.",
      AWAITING_INSPECTION: "Terima kasih kerana memulangkan peralatan anda. Deposit anda akan ditahan sehingga kakitangan ProCam memeriksanya.",
      INSPECTION: "Peralatan anda sedang diperiksa sekarang.",
      DAMAGE_REVIEW: "Satu isu ditemui semasa pemeriksaan. Pasukan kami akan menghubungi anda mengenai deposit anda.",
      COMPLETED: "Sewaan ini telah selesai. Terima kasih kerana menyewa bersama ProCam!",
      CANCELLED: "Tempahan ini telah dibatalkan.",
      EXPIRED: "Tempahan ini telah tamat tempoh sebelum pembayaran selesai.",
    },
    completePayment: "Selesaikan Pembayaran",
    startPickupCheck: "Mula Semakan Pengambilan",
    viewInstructions: "Lihat Arahan",
    beginReturn: "Mula Pemulangan",
    row: {
      pickup: "Pengambilan",
      dropoff: "Penghantaran",
      package: "Pakej",
      equipment: "Peralatan",
      start: "Mula",
      returnBy: "Pulangkan sebelum",
    },
  },
  rating: {
    thanks: "Terima kasih atas maklum balas anda!",
    question: "Bagaimana sewaan anda?",
    rateAria: (value: number) => `Nilaikan ${value} daripada 5 bintang`,
  },
  ratingServer: {
    notRateable: "Tempahan ini belum boleh dinilai lagi.",
    alreadyRated: "Tempahan ini telah dinilai.",
  },
  instructionsCarousel: {
    ofCount: (index: number, total: number) => `${index} daripada ${total}`,
    instructionsFallback: "Arahan",
    noInstructionsYet: "Tiada arahan lagi",
  },
  depositNotice: {
    title: "Sebelum Anda Bayar",
    body: (deposit: number | string) =>
      `Deposit keselamatan RM${deposit} yang boleh dikembalikan akan ditahan pada kad anda pada hari sewaan anda, semasa anda mengambil kamera — bukan hari ini.`,
    cardHint:
      "Pastikan kad yang anda gunakan untuk bayaran hari ini mempunyai sekurang-kurangnya jumlah ini tersedia pada hari pengambilan, jika tidak kami tidak dapat menyerahkan peralatan tersebut.",
    acknowledge: (deposit: number | string) => `Saya faham deposit RM${deposit} akan ditahan pada kad saya semasa pengambilan.`,
    continueToPayment: "Teruskan ke Pembayaran",
    back: "Kembali ke tempahan",
  },
  depositNoticeServer: {
    ackRequired: "Sila sahkan anda faham sebelum meneruskan.",
  },
  pay: {
    title: "Bayar & Sahkan",
    summary: (name: string, price: number | string, deposit: number | string) =>
      `${name} — yuran sewaan RM${price} sekarang. Deposit RM${deposit} yang boleh dikembalikan akan ditahan pada kad yang sama pada hari sewaan anda, semasa pengambilan.`,
    unavailable: "Pembayaran tidak tersedia buat masa ini.",
    devSkip: "[DEV] Langkau Pembayaran — Pintas Stripe",
  },
  paymentForm: {
    payNow: "Bayar Sekarang",
    failed: "Pembayaran gagal. Sila cuba lagi.",
  },
  payServer: {
    alreadyPaid: "Tempahan ini telah dibayar.",
  },
  pickup: {
    stepOf: (step: number, total: number) => `Langkah ${step} daripada ${total}`,
    confirmAndStart: "Sahkan & Mula Sewaan",
    startRental: "Mula Sewaan",
    startingRental: "Memulakan sewaan…",
  },
  pickupServer: {
    notReady: "Tempahan ini belum sedia untuk diambil.",
    noProduct: "Tidak dapat menentukan produk sewaan bagi tempahan ini.",
    noCheckConfigured: "Tiada semakan keadaan ditetapkan untuk produk ini lagi.",
    confirmPrefix: "Sila sahkan: ",
    photoPrefix: "Sila tambah gambar: ",
    saveFailed: "Tidak dapat menyimpan semakan keadaan anda. Sila cuba lagi.",
    depositFailed: "Tidak dapat membuat tahanan deposit keselamatan pada kad anda. Sila cuba kad lain atau minta bantuan staf.",
  },
  returnCheck: {
    stepOf: (step: number, total: number) => `Langkah ${step} daripada ${total}`,
    confirmTitle: "Sahkan",
    issuesTitle: "Ada Masalah?",
    lateFeeWarning: (amount: string) =>
      `Pemulangan ini lewat — yuran lewat sekurang-kurangnya RM${amount} akan ditolak daripada deposit anda.`,
    damageQuestion: "Adakah terdapat sebarang kerosakan atau masalah yang diketahui pada peralatan atau aksesori?",
    noIssues: "Tiada masalah",
    reportIssue: "Laporkan masalah",
    describePlaceholder: "Terangkan apa yang berlaku",
    completeReturn: "Selesaikan Pemulangan",
  },
  returnServer: {
    notActive: "Tempahan ini tidak aktif.",
    noProduct: "Tidak dapat menentukan produk sewaan bagi tempahan ini.",
    noCheckConfigured: "Tiada semakan pemulangan ditetapkan untuk produk ini lagi.",
    confirmPrefix: "Sila sahkan: ",
    photoPrefix: "Sila tambah gambar: ",
    saveFailed: "Tidak dapat menyimpan semakan keadaan anda. Sila cuba lagi.",
  },
  camera: {
    notAvailable: "Akses kamera tidak tersedia dalam pelayar ini.",
    cantAccess: "Tidak dapat mengakses kamera. Semak kebenaran kamera pelayar anda dan cuba lagi.",
    cantProcess: "Tidak dapat memproses gambar itu. Cuba lagi.",
    capture: "Ambil Gambar",
    addAnotherPhoto: "Tambah gambar lain",
    tapToTakeAPhoto: "Ketik untuk mengambil gambar",
    tapToTakePhoto: "Ketik untuk mengambil gambar",
    retake: "Ambil Semula",
    removePhoto: "Buang gambar",
  },
  terms: {
    title: "Terma & Syarat",
    lastUpdated: "Terakhir dikemas kini 13 September 2026.",
    sections: [
      {
        title: "1. Perkhidmatan",
        paragraphs: [
          "ProCam menyewakan kamera aksi dan peralatan kalis air daripada lokar pintar layan diri di lokasi rakan kongsi di Langkawi, Malaysia. Tempahan, pembayaran, pengambilan, dan pemulangan semuanya diuruskan melalui halaman tempahan yang dipautkan daripada kod QR setiap lokar — tiada kaunter atau kakitangan di lokasi.",
        ],
      },
      {
        title: "2. Kelayakan",
        paragraphs: [
          "Anda mestilah berumur sekurang-kurangnya 18 tahun dan berupaya memasuki perjanjian yang mengikat untuk membuat tempahan sewaan. Dengan melengkapkan tempahan, anda mengesahkan perkara ini adalah benar.",
        ],
      },
      {
        title: "3. Tempahan, Harga & Pembayaran",
        paragraphs: [
          "Harga yang ditunjukkan semasa tempahan adalah mengikut tempoh sewaan yang dipilih dan dikenakan dalam Ringgit Malaysia (RM). Tempahan memerlukan sekurang-kurangnya 2 jam notis. Yuran sewaan dikenakan terlebih dahulu; deposit keselamatan yang boleh dikembalikan kemudiannya ditahan pada kaedah pembayaran yang sama sejurus selepas itu — anda tidak akan diminta membayar dua kali. Tempahan yang belum dibayar dan tidak diselesaikan dalam tempoh masa yang singkat akan dibatalkan secara automatik dan peralatan dilepaskan kembali kepada pelanggan lain.",
        ],
      },
      {
        title: "4. Pengesahan Identiti",
        paragraphs: [
          "Untuk membuat tempahan, anda mesti melengkapkan langkah pengesahan identiti (kad pengenalan kerajaan dan swafoto secara langsung, diproses oleh pembekal pengesahan kami). Ini mengesahkan anda adalah individu sebenar yang boleh dipertanggungjawabkan ke atas peralatan sepanjang tempoh sewaan. Kami tidak menyemak atau menyimpan salinan kad pengenalan anda secara manual — lihat {privacyLink} di bawah untuk cara data ini dikendalikan.",
        ],
      },
      {
        title: "5. Pengambilan, Penggunaan & Pemulangan",
        paragraphs: [
          "Anda bertanggungjawab ke atas peralatan dan semua yang terkandung dalam kitnya (kabel, kotak, aksesori) sejak anda membuka petak lokar sehingga kakitangan ProCam telah memeriksa dan menerima pemulangannya. Gunakan peralatan hanya seperti yang dimaksudkan dan hanya untuk tempoh yang ditempah. Setiap halaman produk menunjukkan arahan pengendalian khusus (cth. semakan kedap air untuk sarung kalis air) — mengikutinya adalah tanggungjawab anda, bukan sesuatu yang ProCam boleh sahkan dari jauh.",
          "Pulangkan peralatan ke lokar layan diri sebelum masa tamat yang ditempah. Pemulangan lewat akan dikenakan yuran lewat seperti yang ditunjukkan pada pakej sewaan anda semasa tempahan, dikenakan setiap jam atau sebahagian jam yang lewat.",
        ],
      },
      {
        title: "6. Deposit Keselamatan, Kerosakan & Kehilangan",
        paragraphs: [
          "Deposit keselamatan boleh dikembalikan dan dilepaskan selepas kakitangan memeriksa peralatan yang dipulangkan. Jika peralatan dipulangkan dalam keadaan rosak, kehilangan bahagian, atau tidak dipulangkan langsung, ProCam boleh menahan sebahagian atau kesemua deposit untuk menampung kos pembaikan, penggantian, atau kehilangan. Jika kos tersebut melebihi jumlah deposit, anda tetap bertanggungjawab ke atas baki dan boleh dikenakan bayaran secara berasingan.",
          "Khusus untuk sarung kalis air: deposit dan sebarang penilaian kerosakan hanya meliputi sarung dan kit milik ProCam sahaja. ProCam tidak bertanggungjawab ke atas kerosakan pada telefon atau peranti anda sendiri, termasuk kerosakan akibat air, jika kedap sarung gagal — mengikuti langkah semakan kedap air yang dipandu sebelum memasuki air adalah tanggungjawab anda.",
        ],
      },
      {
        title: "7. Pembatalan & Perubahan",
        paragraphs: [
          "Untuk membatalkan atau menjadualkan semula tempahan yang telah disahkan, hubungi sokongan ProCam melalui halaman tempahan anda secepat mungkin. Kelayakan bayaran balik bergantung kepada berapa lama notis diberikan dan sama ada peralatan telah pun disediakan untuk pengambilan anda.",
        ],
      },
      {
        title: "8. Penggunaan Yang Dilarang",
        paragraphs: [
          "Anda tidak boleh menyewakan semula, menjual semula, atau meminjamkan peralatan kepada sesiapa sahaja, cuba membaiki sendiri, mengalih atau mengusik sebarang label penjejakan atau aset, atau menggunakan peralatan untuk sebarang tujuan yang menyalahi undang-undang. Berbuat demikian membatalkan sebarang bayaran balik deposit dan boleh mengakibatkan caj tambahan.",
        ],
      },
      {
        title: "9. Had Liabiliti",
        paragraphs: [
          "ProCam menyediakan peralatan seadanya dan tidak bertanggungjawab ke atas kerosakan tidak langsung, sampingan, atau berbangkit yang timbul daripada penggunaannya — termasuk kandungan yang hilang, detik yang terlepas, atau tuntutan pihak ketiga — melebihi yuran sewaan dan deposit yang benar-benar dibayar untuk tempahan tersebut. Tiada apa-apa dalam terma ini yang menghadkan liabiliti yang tidak boleh dihadkan di bawah undang-undang Malaysia.",
        ],
      },
      {
        title: "10. Privasi",
        paragraphs: [
          "Kami mengumpul nama, nombor telefon, dan e-mel anda untuk mencipta dan menguruskan tempahan anda, dan memproses dokumen pengenalan dan swafoto melalui pembekal pengesahan identiti kami untuk mengesahkan kelayakan anda membuat tempahan. Butiran pembayaran dikendalikan terus oleh pemproses pembayaran kami — ProCam tidak pernah melihat atau menyimpan nombor kad anda. Maklumat ini digunakan semata-mata untuk tujuan tempahan, pengesahan, sokongan, dan pematuhan undang-undang, dan dikendalikan selaras dengan Akta Perlindungan Data Peribadi (PDPA) Malaysia.",
        ],
      },
      {
        title: "11. Undang-Undang Yang Terpakai",
        paragraphs: [
          "Terma ini ditadbir oleh undang-undang Malaysia. Sebarang pertikaian yang timbul daripada tempahan tertakluk kepada bidang kuasa eksklusif mahkamah Malaysia.",
        ],
      },
      {
        title: "12. Hubungi Kami",
        paragraphs: [
          "Untuk sebarang pertanyaan mengenai terma ini, atau mengenai tempahan yang aktif atau lepas, hantar mesej kepada sokongan ProCam daripada halaman tempahan anda.",
        ],
      },
    ],
    privacyLinkText: "Privasi",
  },
};
