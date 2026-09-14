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
  printPage: {
    title: "Cetak Foto Saya",
    intro: "Muat naik foto terus dari telefon anda — kami akan mencetaknya dan menghantar ke hotel anda, tanpa perlu ke kedai.",
    turnaround: "Dimuat naik sebelum jam 5 petang: dihantar keesokan harinya. Selepas jam 5 petang: dihantar dalam masa 2 hari.",
    table: { size: "Saiz", quantity: "Kuantiti", price: "Harga" },
    sizeLabel: { "4R": "4R (4×6\")" },
    quantityLabel: (qty: number) => `${qty} cetakan`,
    freeLine: (hotelName: string) => `Percuma — ihsan ${hotelName}`,
    chooseSize: "Saiz",
    chooseQuantity: "Berapa banyak cetakan?",
    printsHeading: "Cetakan Anda",
    printsHint: "Ketik cetakan untuk menambah 1 foto, atau kolaj 2 foto.",
    slotEmpty: "Tambah",
    slotEdit: "Sunting",
    slotRemove: "Buang",
    slotsReady: (count: number, needed: number) => `${count} daripada ${needed} sedia`,
    continueToReview: "Semak Pesanan",
    reviewHeading: "Semak Cetakan Anda",
    namePlaceholder: "Nama penuh",
    phonePlaceholder: "Nombor telefon, dengan kod negara, cth. +60123456789",
    emailPlaceholder: "E-mel (pilihan)",
    summaryTotal: (total: number | string) => `Jumlah: RM${total}`,
    submit: "Hantar Pesanan",
    submitting: "Menghantar…",
  },
  collageEditor: {
    chooseLayout: "Susun Atur",
    layoutSingle: "1 Foto",
    layoutSplitH: "2 Foto — Bertindan",
    layoutSplitV: "2 Foto — Bersebelahan",
    twoPhotoWarning:
      "Memuatkan dua foto dalam satu cetakan menjadikan setiap foto lebih kecil — masih boleh dicetak, tetapi wajah atau perincian halus mungkin lebih sukar dilihat dari dekat.",
    addPhoto: "Tambah Foto",
    dragHint: "Seret untuk mengubah kedudukan",
    usePhoto: "Guna Foto Ini",
    cancel: "Batal",
    processing: "Memproses…",
    compositeFailed: "Tidak dapat memproses foto ini. Sila cuba lagi.",
  },
  photoPrintConfirm: {
    title: "Pesanan Diterima",
    freeBody: (hotelName: string) => `Foto anda sedang dalam proses percetakan, ihsan ${hotelName}.`,
    paidBody: "Pembayaran diterima — foto anda sedang dalam proses percetakan.",
    turnaround: "Dimuat naik sebelum jam 5 petang: dihantar ke hotel anda keesokan harinya. Selepas jam 5 petang: dalam masa 2 hari.",
    back: "Kembali ke halaman hotel",
    readyTitle: "Sedia untuk Diambil",
    readyBody: (slotNumber: number, hotelName: string) => `Ambil sebelum jam 10:30 pagi di Slot ${slotNumber} di ${hotelName}.`,
    askReception: "Sila tanya bahagian penerimaan tetamu jika anda tidak tahu lokasi slot pengambilan.",
    boxWarning: (time: string) => `Foto yang tidak diambil dalam masa 24 jam (menjelang ${time}) akan dimasukkan ke dalam kotak kayu.`,
    movedToBoxTitle: "Dipindahkan ke Kotak Kayu",
    movedToBoxBody: (hotelName: string) => `Cetakan anda berada dalam kotak kayu di ${hotelName}, bukan slot bernombor.`,
    cancelledTitle: "Pesanan Dibatalkan",
    cancelledBody: "Pesanan ini telah dibatalkan.",
  },
  photoPrintPay: {
    title: "Bayar untuk Cetakan Anda",
    summary: (quantity: number, size: string, total: number | string) => `${quantity} × foto ${size} — jumlah RM${total}`,
    unavailable: "Pembayaran tidak tersedia buat masa ini.",
  },
  photoPrintServer: {
    hotelUnavailable: "Hotel ini tidak tersedia buat masa ini.",
    wrongPhotoCount: (needed: number) => `Sila muat naik tepat ${needed} foto.`,
    orderFailed: "Tidak dapat membuat pesanan anda. Sila cuba lagi.",
    alreadyPaid: "Pesanan ini telah dibayar.",
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
    // TODO: translate — added 2026-09-14, English placeholder per instruction not to self-translate new text.
    droneBatteryNote: "NOTE: 1 full battery powers about 12–15 minutes of flight.",
    droneBatteryTip: "Recommended: keep 2 batteries charging in your hotel room, bring the other 2 out with you, and swap when you head back.",
    droneComesWith: (count: number) => {
      if (count === 2) return "Comes with 2 batteries (30 minutes flight time)";
      if (count === 4) return "Comes with 4 batteries + 3-slot battery charger + Powerbank";
      return `Comes with ${count} batter${count === 1 ? "y" : "ies"}`;
    },
    mode: { daytime: "Siang", overnight: "Semalaman", multiday: "Berbilang Hari" },
    hint: {
      overnight: "Ambil pada jam 9 malam, pulangkan sebelum jam 8 pagi — tempahan memerlukan sekurang-kurangnya 2 jam notis.",
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
